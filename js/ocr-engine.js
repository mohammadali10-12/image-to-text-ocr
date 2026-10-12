/**
 * Thin wrapper around a single Tesseract.js worker.
 * The library, engine and language data are loaded lazily from jsDelivr the first time OCR runs.
 */
import { loadScript } from './utils.js';

const TESSERACT_VERSION = '7.0.0';
const CORE_VERSION = '7.0.0';
const CDN = 'https://cdn.jsdelivr.net/npm';

export const OCR_URLS = Object.freeze({
  library: `${CDN}/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`,
  worker: `${CDN}/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`,
  core: `${CDN}/tesseract.js-core@${CORE_VERSION}`,
});

/** Folder holding the (LSTM, integer) trained data for a language. */
const langPathFor = (lang) => `${CDN}/@tesseract.js-data/${lang}/4.0.0_best_int`;

/**
 * Confirms the language file exists before starting a worker. Tesseract.js does not
 * reject createWorker() when language data is missing, so this gives a clear error early.
 */
async function checkLanguageAvailable(lang) {
  let response;
  try {
    response = await fetch(`${langPathFor(lang)}/${lang}.traineddata.gz`, { method: 'HEAD', mode: 'cors', credentials: 'omit' });
  } catch {
    throw new OcrError('Language data could not be downloaded. Check your internet connection and try again.', 'network');
  }
  if (!response.ok) {
    throw new OcrError(`Language data for “${lang}” is not available right now (HTTP ${response.status}). Try again later or choose another language.`, 'language');
  }
}

export class OcrError extends Error {
  constructor(message, kind = 'ocr') {
    super(message);
    this.kind = kind;
  }
}

/** Maps Tesseract.js logger statuses to friendly labels. */
function describeStatus(status) {
  switch (status) {
    case 'loading tesseract core': return 'Loading OCR engine';
    case 'initializing tesseract': return 'Starting OCR engine';
    case 'loading language traineddata':
    case 'loading language traineddata (from cache)': return 'Loading language data';
    case 'initializing api': return 'Initializing language';
    case 'recognizing text': return 'Recognizing text';
    default: return null;
  }
}

async function loadLibrary() {
  if (window.Tesseract) return window.Tesseract;
  try {
    await loadScript(OCR_URLS.library);
  } catch {
    throw new OcrError('The OCR engine could not be downloaded. Check your internet connection and try again.', 'network');
  }
  if (!window.Tesseract || typeof window.Tesseract.createWorker !== 'function') {
    throw new OcrError('The OCR engine loaded but could not start.', 'init');
  }
  return window.Tesseract;
}

export class OcrEngine {
  #worker = null;
  #lang = null;
  #creating = null;
  #listener = null;
  #generation = 0;

  get language() {
    return this.#lang;
  }

  /** Begins downloading the library without starting a worker. */
  preload() {
    loadLibrary().catch(() => { /* reported later when OCR actually runs */ });
  }

  #log = (message) => {
    if (!this.#listener || !message) return;
    const label = describeStatus(message.status);
    if (!label) return;
    const progress = typeof message.progress === 'number' ? message.progress : null;
    this.#listener({ stage: message.status === 'recognizing text' ? 'recognize' : 'load', label, progress });
  };

  async #ensureWorker(lang) {
    if (this.#worker && this.#lang === lang) return this.#worker;
    if (this.#creating) {
      try { await this.#creating; } catch { /* handled below */ }
      if (this.#worker && this.#lang === lang) return this.#worker;
    }

    // Different language requested: start a fresh worker so only the needed data is loaded.
    await this.terminate();

    const generation = this.#generation;
    this.#creating = (async () => {
      const Tesseract = await loadLibrary();
      await checkLanguageAvailable(lang);

      // Errors while loading language data are only reported through errorHandler
      // (the createWorker promise never settles), so race against it.
      let created = false;
      let failStartup;
      const startupFailure = new Promise((_, reject) => { failStartup = reject; });
      startupFailure.catch(() => {});

      let worker;
      try {
        worker = await Promise.race([
          Tesseract.createWorker(lang, Tesseract.OEM ? Tesseract.OEM.LSTM_ONLY : 1, {
            workerPath: OCR_URLS.worker,
            corePath: OCR_URLS.core,
            langPath: langPathFor(lang),
            logger: this.#log,
            errorHandler: (data) => {
              if (!created) failStartup(new Error(String(data)));
              /* After startup, failures reject the recognize() promise instead. */
            },
          }),
          startupFailure,
        ]);
        created = true;
      } catch (err) {
        const text = String(err && (err.message || err));
        if (/traineddata|network error|fetch/i.test(text)) {
          throw new OcrError('Language data could not be loaded. Check your internet connection or choose another language.', 'language');
        }
        throw new OcrError(`The OCR engine failed to start: ${text}`, 'init');
      }
      if (generation !== this.#generation) {
        // Cancelled while starting up.
        worker.terminate().catch(() => {});
        throw new OcrError('Cancelled', 'cancelled');
      }
      this.#worker = worker;
      this.#lang = lang;
      return worker;
    })();

    try {
      return await this.#creating;
    } finally {
      this.#creating = null;
    }
  }

  /**
   * Recognizes text in an image Blob.
   * @param {Blob} image
   * @param {string} lang Tesseract language code
   * @param {(update: {stage: string, label: string, progress: number|null}) => void} onProgress
   */
  async recognize(image, lang, onProgress) {
    this.#listener = onProgress;
    try {
      const worker = await this.#ensureWorker(lang);
      onProgress({ stage: 'recognize', label: 'Recognizing text', progress: 0 });
      let result;
      try {
        result = await worker.recognize(image, {}, { text: true, blocks: true });
      } catch (err) {
        throw new OcrError(`Text recognition failed: ${err && (err.message || err)}`, 'recognize');
      }
      const data = (result && result.data) || {};
      const fromLayout = textFromBlocks(data.blocks);
      const plain = typeof data.text === 'string' ? data.text : '';
      const text = normalizeText(fromLayout !== null ? fromLayout : plain);
      return { text, confidence: typeof data.confidence === 'number' ? data.confidence : null };
    } finally {
      this.#listener = null;
    }
  }

  async terminate() {
    const worker = this.#worker;
    this.#worker = null;
    this.#lang = null;
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        /* Worker already gone. */
      }
    }
  }

  /** Immediately stops any running job. Pending recognize() promises are abandoned by the caller. */
  forceStop() {
    this.#generation += 1;
    const worker = this.#worker;
    this.#worker = null;
    this.#lang = null;
    this.#creating = null;
    if (worker) worker.terminate().catch(() => {});
  }
}

/**
 * Rebuilds text from Tesseract's layout so paragraphs keep their blank lines.
 * A blank line is inserted between blocks/paragraphs and wherever the vertical
 * gap between two lines is clearly larger than a normal line gap.
 * Returns null if layout data is unavailable.
 */
function textFromBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return null;
  const lines = [];
  blocks.forEach((block, b) => {
    (block.paragraphs || []).forEach((para, p) => {
      (para.lines || []).forEach((line) => {
        const text = (line.text || '').replace(/\s+$/u, '');
        if (!text.trim() || !line.bbox) return;
        lines.push({ text, top: line.bbox.y0, bottom: line.bbox.y1, para: `${b}:${p}` });
      });
    });
  });
  if (!lines.length) return '';

  const heights = lines.map((l) => l.bottom - l.top).sort((x, y) => x - y);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 1;

  let out = lines[0].text;
  for (let i = 1; i < lines.length; i += 1) {
    const prev = lines[i - 1];
    const cur = lines[i];
    const gap = cur.top - prev.bottom;
    const newParagraph = cur.para !== prev.para || gap > medianHeight * 1.2;
    out += (newParagraph ? '\n\n' : '\n') + cur.text;
  }
  return out;
}

/** Trims trailing spaces on each line and collapses runs of 3+ blank lines while keeping paragraphs. */
function normalizeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

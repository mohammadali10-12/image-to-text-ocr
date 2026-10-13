/**
 * ImageToText OCR — UI controller.
 * Images are decoded and recognized locally; nothing is uploaded.
 */
import { initThemeToggle } from './theme.js';
import { OcrEngine, OcrError } from './ocr-engine.js';
import {
  MAX_FILES,
  MAX_OCR_DIMENSION,
  ImageError,
  validateFile,
  inspectFile,
  prepareItem,
  makePreviewUrl,
  makeThumbUrl,
  prepareForOcr,
} from './image-loader.js';
import { LANGUAGES, languageInfo } from './languages.js';
import { formatBytes, safeFileBase, countWords, countCharacters, clamp } from './utils.js';

const $ = (id) => document.getElementById(id);

const el = {
  heroCta: $('hero-cta'),
  workspace: $('workspace'),
  language: $('language-select'),
  fileInput: $('file-input'),
  dropzone: $('dropzone'),
  inputPanel: document.querySelector('.panel-input'),
  preview: $('preview'),
  previewImage: $('preview-image'),
  previewLoading: $('preview-loading'),
  fileName: $('file-name'),
  fileDetails: $('file-details'),
  rotateLeft: $('rotate-left'),
  rotateRight: $('rotate-right'),
  replaceBtn: $('replace-image'),
  removeBtn: $('remove-image'),
  queue: $('queue'),
  queueTitle: $('queue-title'),
  queueList: $('queue-list'),
  addMore: $('add-more'),
  enhance: $('enhance-toggle'),
  alert: $('input-alert'),
  progressBlock: $('progress-block'),
  progressLabel: $('progress-label'),
  progressValue: $('progress-value'),
  progressBar: $('progress-bar'),
  progressFill: $('progress-fill'),
  progressBatch: $('progress-batch'),
  extractBtn: $('extract-btn'),
  extractLabel: $('extract-label'),
  retryBtn: $('retry-btn'),
  cancelBtn: $('cancel-btn'),
  clearAllBtn: $('clear-all-btn'),
  output: $('output-text'),
  emptyState: $('empty-state'),
  emptyTitle: $('empty-title'),
  emptyText: $('empty-text'),
  charCount: $('char-count'),
  wordCount: $('word-count'),
  copyBtn: $('copy-btn'),
  downloadBtn: $('download-btn'),
  selectBtn: $('select-btn'),
  clearTextBtn: $('clear-text-btn'),
  toastRegion: $('toast-region'),
  year: $('year'),
};

const STATUS_LABELS = {
  queued: 'Ready',
  working: 'Working',
  done: 'Done',
  empty: 'No text',
  error: 'Error',
};

const engine = new OcrEngine();

const state = {
  items: [],
  activeId: null,
  running: false,
  cancelRun: null, // function that aborts the current run
  replaceTargetId: null,
  editedSinceOcr: false,
  resultBaseName: 'extracted-text',
  previewToken: 0,
  nextId: 1,
  loadingFiles: 0,
};

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function showAlert(type, message, details = []) {
  el.alert.className = `alert alert-${type}`;
  el.alert.replaceChildren();
  const wrap = document.createElement('div');
  const p = document.createElement('p');
  p.textContent = message;
  wrap.append(p);
  if (details.length) {
    const ul = document.createElement('ul');
    for (const line of details) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.append(li);
    }
    wrap.append(ul);
  }
  el.alert.append(wrap);
  el.alert.hidden = false;
}

function hideAlert() {
  el.alert.hidden = true;
  el.alert.replaceChildren();
}

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.textContent = message;
  el.toastRegion.append(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 250);
  }, 2600);
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

function setProgress(label, fraction, batchText = '') {
  el.progressBlock.hidden = false;
  el.progressBlock.classList.remove('is-complete', 'is-error');
  el.progressLabel.textContent = label;
  if (fraction == null) {
    el.progressValue.textContent = '';
    el.progressBar.removeAttribute('aria-valuenow');
  } else {
    const pct = Math.round(clamp(fraction, 0, 1) * 100);
    el.progressValue.textContent = `${pct}%`;
    el.progressBar.setAttribute('aria-valuenow', String(pct));
    el.progressFill.style.width = `${pct}%`;
  }
  el.progressBatch.hidden = !batchText;
  el.progressBatch.textContent = batchText;
}

function finishProgress(kind, label) {
  el.progressBlock.hidden = false;
  el.progressBlock.classList.toggle('is-complete', kind === 'complete');
  el.progressBlock.classList.toggle('is-error', kind === 'error');
  el.progressLabel.textContent = label;
  if (kind === 'complete') {
    el.progressValue.textContent = '100%';
    el.progressFill.style.width = '100%';
    el.progressBar.setAttribute('aria-valuenow', '100');
  } else {
    el.progressValue.textContent = '';
  }
  el.progressBatch.hidden = true;
}

function resetProgress() {
  el.progressBlock.hidden = true;
  el.progressBlock.classList.remove('is-complete', 'is-error');
  el.progressFill.style.width = '0%';
  el.progressBar.setAttribute('aria-valuenow', '0');
}

/* ------------------------------------------------------------------ */
/* Items (images)                                                      */
/* ------------------------------------------------------------------ */

const activeItem = () => state.items.find((item) => item.id === state.activeId) || null;

function releaseItem(item) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
  item.previewUrl = null;
  item.thumbUrl = null;
  item.released = true;
}

const fileKey = (file) => `${file.name}|${file.size}|${file.lastModified}`;

/** Validates the file's real contents and builds a queue item. No decoded pixels are kept. */
async function createItem(file) {
  const info = await inspectFile(file);
  const item = {
    id: state.nextId++,
    key: fileKey(file),
    file,
    format: info.format,
    name: file.name || 'pasted-image.png',
    size: file.size,
    width: info.width,
    height: info.height,
    rotation: 0,
    previewUrl: null,
    previewKey: '',
    thumbUrl: null,
    status: 'queued',
    text: '',
    error: null,
    released: false,
  };
  try {
    await prepareItem(item);
  } catch (err) {
    releaseItem(item);
    throw err;
  }
  return item;
}

/** Turns low-level browser failures (often memory exhaustion) into a helpful message. */
function describeFailure(err, fallback) {
  if (err instanceof ImageError || err instanceof OcrError) return err.message;
  const text = String((err && (err.name || '')) + ' ' + (err && err.message ? err.message : err));
  if (/RangeError|memory|allocat|Aw, Snap|InvalidStateError/i.test(text)) {
    return 'Your browser ran out of memory while processing this image. Try a smaller image, process fewer images at once, or close other tabs.';
  }
  return fallback;
}

/**
 * Validates, decodes and adds files. When `replaceId` is set, the first valid file replaces that item.
 */
async function addFiles(fileList, { replaceId = null } = {}) {
  if (state.running) {
    toast('Please wait until text extraction finishes.', 'warning');
    return;
  }
  const files = Array.from(fileList || []);
  if (!files.length) return;

  hideAlert();
  const problems = [];
  const accepted = [];
  const slotsLeft = replaceId ? 1 : MAX_FILES - state.items.length;
  const existing = new Set(state.items.filter((item) => item.id !== replaceId).map((item) => item.key));

  for (const file of files) {
    const error = validateFile(file);
    if (error) {
      problems.push(`${file.name || 'Pasted image'}: ${error}`);
    } else if (existing.has(fileKey(file))) {
      problems.push(`${file.name}: already added.`);
    } else if (accepted.length >= slotsLeft) {
      problems.push(`${file.name}: skipped — you can add up to ${MAX_FILES} images at a time.`);
    } else {
      accepted.push(file);
    }
  }

  if (!accepted.length && !problems.length) return;

  state.loadingFiles += 1;
  setBusyLoading(true);
  const added = [];
  try {
    for (const file of accepted) {
      try {
        const item = await createItem(file);
        existing.add(item.key);
        added.push(item);
      } catch (err) {
        problems.push(`${file.name}: ${describeFailure(err, 'This image could not be opened.')}`);
      }
    }
  } finally {
    state.loadingFiles -= 1;
    setBusyLoading(false);
  }

  if (added.length) {
    if (replaceId != null) {
      const index = state.items.findIndex((item) => item.id === replaceId);
      if (index >= 0) {
        releaseItem(state.items[index]);
        state.items.splice(index, 1, added[0]);
      } else {
        state.items.push(added[0]);
      }
    } else {
      state.items.push(...added);
    }
    state.activeId = added[0].id;
    resetProgress();
    engine.preload();
  }

  if (problems.length) {
    const heading = added.length
      ? `${added.length} image${added.length === 1 ? '' : 's'} added, but some files were skipped:`
      : (problems.length === 1 ? 'That file could not be added.' : 'These files could not be added:');
    showAlert(added.length ? 'warning' : 'error', heading, problems);
  } else if (added.length > 1) {
    toast(`${added.length} images added`);
  }

  render();
}

function setBusyLoading(isLoading) {
  if (isLoading) {
    el.dropzone.classList.add('is-disabled');
    if (!el.preview.hidden) el.previewLoading.hidden = false;
  } else if (state.loadingFiles === 0) {
    el.dropzone.classList.remove('is-disabled');
    el.previewLoading.hidden = true;
  }
}

function removeItem(id) {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = state.items.splice(index, 1);
  releaseItem(item);
  const next = state.items[index] || state.items[index - 1] || null;
  state.activeId = next ? next.id : null;
  if (!state.items.length) resetProgress();
  hideAlert();
  render();
}

async function rotateActive(delta) {
  const item = activeItem();
  if (!item || state.running) return;
  item.rotation = (item.rotation + delta + 360) % 360;
  if (item.status !== 'queued') item.status = 'queued';
  render();
  try {
    const thumb = await makeThumbUrl(item);
    if (item.released) {
      URL.revokeObjectURL(thumb);
      return;
    }
    if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
    item.thumbUrl = thumb;
    renderQueue();
  } catch {
    /* keep old thumbnail */
  }
}

/** Marks the editor with the OCR language so screen readers, fonts and RTL scripts behave correctly. */
function applyOutputLanguage(code) {
  const info = languageInfo(code);
  el.output.lang = info.bcp47;
  el.output.dir = info.dir === 'rtl' ? 'rtl' : 'auto';
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

async function renderPreview() {
  const item = activeItem();
  if (!item) {
    el.previewImage.removeAttribute('src');
    return;
  }

  const dims = item.width && item.height ? `${item.width.toLocaleString()} × ${item.height.toLocaleString()} px` : 'size unknown';
  const scaled = Math.max(item.width, item.height) > MAX_OCR_DIMENSION ? ' · scaled for OCR' : '';
  const rotation = item.rotation ? ` · rotated ${item.rotation}°` : '';
  el.fileName.textContent = item.name;
  el.fileName.title = item.name;
  el.fileDetails.textContent = `${formatBytes(item.size)} · ${dims}${scaled}${rotation}`;
  el.previewImage.alt = `Preview of ${item.name}`;

  const key = `${item.rotation}|${el.enhance.checked ? 1 : 0}`;
  if (item.previewUrl && item.previewKey === key) {
    if (el.previewImage.getAttribute('src') !== item.previewUrl) el.previewImage.src = item.previewUrl;
    return;
  }

  const token = ++state.previewToken;
  el.previewLoading.hidden = false;
  try {
    const url = await makePreviewUrl(item, el.enhance.checked);
    if (token !== state.previewToken || item.released) {
      URL.revokeObjectURL(url);
      return;
    }
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    item.previewUrl = url;
    item.previewKey = key;
    el.previewImage.src = url;
  } catch (err) {
    if (token === state.previewToken) showAlert('error', describeFailure(err, 'The preview could not be created. The image may be too large for your device.'));
  } finally {
    if (token === state.previewToken) el.previewLoading.hidden = state.loadingFiles === 0;
  }
}

function renderQueue() {
  const many = state.items.length > 1;
  el.queue.hidden = !many;
  if (!many) {
    el.queueList.replaceChildren();
    return;
  }
  el.queueTitle.textContent = `Images (${state.items.length}/${MAX_FILES})`;
  const fragment = document.createDocumentFragment();
  state.items.forEach((item, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-item';
    button.dataset.id = String(item.id);
    button.setAttribute('aria-current', String(item.id === state.activeId));
    button.setAttribute('aria-label', `Image ${index + 1}: ${item.name}, ${STATUS_LABELS[item.status]}`);

    const thumb = document.createElement('img');
    thumb.className = 'queue-thumb';
    thumb.alt = '';
    if (item.thumbUrl) thumb.src = item.thumbUrl;

    const name = document.createElement('span');
    name.className = 'queue-name';
    name.textContent = item.name;

    const badge = document.createElement('span');
    badge.className = `badge badge-${item.status}`;
    badge.textContent = STATUS_LABELS[item.status];
    if (item.error) badge.title = item.error;

    button.append(thumb, name, badge);
    li.append(button);
    fragment.append(li);
  });
  el.queueList.replaceChildren(fragment);
  el.addMore.disabled = state.running || state.items.length >= MAX_FILES;
}

function renderControls() {
  const hasItems = state.items.length > 0;
  const hasText = el.output.value.length > 0;
  const running = state.running;
  const failed = state.items.some((item) => item.status === 'error');
  const pending = state.items.some((item) => item.status === 'queued');

  el.dropzone.hidden = hasItems;
  el.preview.hidden = !hasItems;

  el.extractBtn.disabled = !hasItems || running;
  el.extractLabel.textContent = running
    ? 'Extracting…'
    : (hasItems && !pending && !failed ? 'Extract again' : (state.items.length > 1 ? `Extract text (${state.items.length} images)` : 'Extract text'));
  el.retryBtn.hidden = running || !failed;
  el.cancelBtn.hidden = !running;
  el.clearAllBtn.disabled = running || (!hasItems && !hasText);

  el.language.disabled = running;
  el.enhance.disabled = running;
  el.rotateLeft.disabled = running;
  el.rotateRight.disabled = running;
  el.replaceBtn.disabled = running;
  el.removeBtn.disabled = running;
  el.dropzone.setAttribute('aria-disabled', String(running));
  el.inputPanel.setAttribute('aria-busy', String(running));

  el.copyBtn.disabled = !hasText;
  el.downloadBtn.disabled = !hasText;
  el.selectBtn.disabled = !hasText;
  el.clearTextBtn.disabled = !hasText || running;
}

let countFrame = 0;
function renderTextStats() {
  cancelAnimationFrame(countFrame);
  countFrame = requestAnimationFrame(() => {
    const text = el.output.value;
    el.charCount.textContent = countCharacters(text).toLocaleString();
    el.wordCount.textContent = countWords(text).toLocaleString();
  });
  el.emptyState.hidden = el.output.value.length > 0;
}

function setEmptyState(kind) {
  el.emptyState.classList.toggle('is-warning', kind === 'no-text');
  if (kind === 'no-text') {
    el.emptyTitle.textContent = 'No readable text found';
    el.emptyText.textContent = 'Try a sharper or larger image, rotate it so the text is upright, enable “Enhance image”, or check the selected language.';
  } else {
    el.emptyTitle.textContent = 'Your text will appear here';
    el.emptyText.replaceChildren(
      'Add an image and choose ',
      Object.assign(document.createElement('strong'), { textContent: 'Extract text' }),
      '. You can edit the result before copying or downloading it.',
    );
  }
}

function render() {
  renderControls();
  renderQueue();
  renderPreview();
  renderTextStats();
}

/* ------------------------------------------------------------------ */
/* OCR                                                                 */
/* ------------------------------------------------------------------ */

function composeResult() {
  const withText = state.items.filter((item) => item.status === 'done' && item.text);
  if (state.items.length === 1) return withText[0] ? withText[0].text : '';
  return withText.map((item) => `===== ${item.name} =====\n${item.text}`).join('\n\n');
}

function friendlyError(err) {
  return describeFailure(err, `Something went wrong: ${err && err.message ? err.message : String(err)}`);
}

async function runOcr(mode = 'all') {
  if (state.running || !state.items.length) return;

  if (state.editedSinceOcr && el.output.value.trim()) {
    const ok = window.confirm('Running OCR will replace the text you edited. Continue?');
    if (!ok) return;
  }

  const lang = el.language.value;
  const enhance = el.enhance.checked;
  const targets = state.items.filter((item) => (mode === 'retry' ? item.status === 'error' || item.status === 'queued' : true));
  if (!targets.length) return;

  for (const item of targets) {
    item.status = 'queued';
    item.error = null;
    if (mode === 'all') item.text = '';
  }

  let cancelled = false;
  let rejectCancel;
  const cancelPromise = new Promise((_, reject) => { rejectCancel = reject; });
  cancelPromise.catch(() => {});
  state.cancelRun = () => {
    cancelled = true;
    engine.forceStop();
    rejectCancel(new OcrError('Cancelled', 'cancelled'));
  };

  state.running = true;
  hideAlert();
  render();

  const total = targets.length;
  const batchLine = (index, fraction) => (total > 1
    ? `Image ${index + 1} of ${total} · ${Math.round(((index + fraction) / total) * 100)}% of batch complete`
    : '');

  let fatal = null;
  for (let i = 0; i < total; i += 1) {
    const item = targets[i];
    if (cancelled) break;
    state.activeId = item.id;
    item.status = 'working';
    renderQueue();
    renderPreview();

    try {
      setProgress('Preparing image', 0, batchLine(i, 0));
      const blob = await Promise.race([prepareForOcr(item, enhance), cancelPromise]);

      const onProgress = ({ stage, label, progress }) => {
        if (cancelled) return;
        const p = progress == null ? null : progress;
        const overall = stage === 'recognize' && p != null ? p : 0;
        setProgress(label, p, batchLine(i, overall));
      };
      const { text } = await Promise.race([engine.recognize(blob, lang, onProgress), cancelPromise]);
      item.text = text;
      item.status = text ? 'done' : 'empty';
    } catch (err) {
      if (cancelled || (err instanceof OcrError && err.kind === 'cancelled')) {
        item.status = 'queued';
        break;
      }
      item.status = 'error';
      item.error = friendlyError(err);
      // Engine or language failures affect every remaining image: stop the batch.
      if (err instanceof OcrError && ['network', 'init', 'language'].includes(err.kind)) {
        fatal = err;
        for (const rest of targets.slice(i + 1)) rest.status = 'queued';
        await engine.terminate();
        break;
      }
    }
    renderQueue();
  }

  state.running = false;
  state.cancelRun = null;

  // Items finished with "empty" are treated as done (no text) for composing.
  const composed = composeResult();
  const doneCount = state.items.filter((item) => item.status === 'done').length;
  const emptyCount = state.items.filter((item) => item.status === 'empty').length;
  const failed = state.items.filter((item) => item.status === 'error');

  if (cancelled) {
    finishProgress('error', 'Extraction cancelled');
    toast('Extraction cancelled', 'warning');
  } else if (fatal) {
    finishProgress('error', 'Extraction failed');
    showAlert('error', `${fatal.message} Use Retry to try again.`);
  } else if (failed.length) {
    finishProgress('error', `Finished with ${failed.length} error${failed.length === 1 ? '' : 's'}`);
    showAlert('error', 'Some images could not be processed. Use Retry to try them again.', failed.map((item) => `${item.name}: ${item.error}`));
  } else if (!doneCount) {
    finishProgress('complete', 'Processing complete');
    showAlert('warning', 'No readable text was found. Try a clearer image, rotate it upright, enable “Enhance image”, or choose a different language.');
  } else {
    finishProgress('complete', 'Processing complete');
    if (emptyCount) {
      showAlert('warning', `${emptyCount} image${emptyCount === 1 ? '' : 's'} had no readable text.`);
    }
    toast(state.items.length > 1 ? `Text extracted from ${doneCount} images` : 'Text extracted');
  }

  if (!cancelled) {
    applyOutputLanguage(lang);
    el.output.value = composed;
    state.editedSinceOcr = false;
    state.resultBaseName = state.items.length === 1
      ? safeFileBase(state.items[0].name)
      : `extracted-text-${state.items.length}-images`;
    setEmptyState(composed ? 'default' : 'no-text');
  }

  render();
}

/* ------------------------------------------------------------------ */
/* Text actions                                                        */
/* ------------------------------------------------------------------ */

async function copyText() {
  const text = el.output.value;
  if (!text) return;
  let copied = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
  }
  if (!copied) {
    // Fallback for older browsers or blocked clipboard permissions.
    const { selectionStart, selectionEnd } = el.output;
    el.output.focus();
    el.output.select();
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    el.output.setSelectionRange(selectionStart, selectionEnd);
  }
  if (copied) toast('Text copied to clipboard');
  else toast('Copy failed — select the text and press Ctrl+C', 'error');
}

function downloadText() {
  const text = el.output.value;
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.resultBaseName || 'extracted-text'}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Downloaded ${link.download}`);
}

function selectAllText() {
  el.output.focus();
  el.output.select();
}

function clearText() {
  el.output.value = '';
  state.editedSinceOcr = false;
  setEmptyState('default');
  render();
  el.output.focus();
}

function clearAll() {
  if (state.running) return;
  for (const item of state.items) releaseItem(item);
  state.items = [];
  state.activeId = null;
  state.editedSinceOcr = false;
  state.resultBaseName = 'extracted-text';
  el.output.value = '';
  el.fileInput.value = '';
  el.enhance.checked = false;
  hideAlert();
  resetProgress();
  setEmptyState('default');
  engine.terminate();
  render();
  toast('Workspace cleared');
  el.dropzone.focus();
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function openFilePicker({ replaceId = null } = {}) {
  if (state.running) return;
  state.replaceTargetId = replaceId;
  el.fileInput.multiple = replaceId == null;
  el.fileInput.click();
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function initDragAndDrop() {
  let depth = 0;
  const target = el.inputPanel;

  target.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth += 1;
    el.dropzone.classList.add('is-dragover');
  });
  target.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = state.running ? 'none' : 'copy';
  });
  target.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) el.dropzone.classList.remove('is-dragover');
  });
  target.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    el.dropzone.classList.remove('is-dragover');
    addFiles(event.dataTransfer.files);
  });

  // Stop the browser from navigating away when a file is dropped outside the panel.
  window.addEventListener('dragover', (event) => {
    if (hasFiles(event)) event.preventDefault();
  });
  window.addEventListener('drop', (event) => {
    if (hasFiles(event) && !target.contains(event.target)) {
      event.preventDefault();
      toast('Drop images on the upload area', 'warning');
    }
  });
}

function initPaste() {
  document.addEventListener('paste', (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return; // let normal text pasting happen
    event.preventDefault();
    const named = files.map((file, index) => (file.name && file.name !== 'image.png'
      ? file
      : new File([file], `pasted-image-${Date.now()}${index ? `-${index}` : ''}.${(file.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, { type: file.type })));
    addFiles(named);
    el.workspace.scrollIntoView({ block: 'start' });
  });
}

function bindEvents() {
  el.heroCta.addEventListener('click', () => {
    el.workspace.scrollIntoView({ block: 'start' });
    if (!state.items.length) openFilePicker();
    else el.extractBtn.focus({ preventScroll: true });
  });

  el.dropzone.addEventListener('click', () => openFilePicker());
  el.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFilePicker();
    }
  });

  el.fileInput.addEventListener('change', () => {
    const replaceId = state.replaceTargetId;
    state.replaceTargetId = null;
    const files = Array.from(el.fileInput.files || []);
    el.fileInput.value = ''; // allow choosing the same file again
    el.fileInput.multiple = true;
    addFiles(files, { replaceId });
  });

  el.addMore.addEventListener('click', () => openFilePicker());
  el.replaceBtn.addEventListener('click', () => openFilePicker({ replaceId: state.activeId }));
  el.removeBtn.addEventListener('click', () => removeItem(state.activeId));
  el.rotateLeft.addEventListener('click', () => rotateActive(-90));
  el.rotateRight.addEventListener('click', () => rotateActive(90));

  el.queueList.addEventListener('click', (event) => {
    const button = event.target.closest('.queue-item');
    if (!button) return;
    state.activeId = Number(button.dataset.id);
    renderQueue();
    renderPreview();
  });

  el.enhance.addEventListener('change', () => {
    for (const item of state.items) if (item.status !== 'error') item.status = 'queued';
    render();
  });
  el.language.addEventListener('change', () => {
    for (const item of state.items) if (item.status !== 'error') item.status = 'queued';
    if (!el.output.value) applyOutputLanguage(el.language.value);
    render();
  });

  el.extractBtn.addEventListener('click', () => runOcr('all'));
  el.extractBtn.addEventListener('pointerenter', () => engine.preload(), { once: true });
  el.retryBtn.addEventListener('click', () => runOcr('retry'));
  el.cancelBtn.addEventListener('click', () => state.cancelRun && state.cancelRun());
  el.clearAllBtn.addEventListener('click', clearAll);

  el.output.addEventListener('input', () => {
    state.editedSinceOcr = true;
    if (!el.output.value) setEmptyState('default');
    renderTextStats();
    renderControls();
  });
  el.copyBtn.addEventListener('click', copyText);
  el.downloadBtn.addEventListener('click', downloadText);
  el.selectBtn.addEventListener('click', selectAllText);
  el.clearTextBtn.addEventListener('click', clearText);

  // Free the OCR worker when the page is really closed (not when it is kept in the back/forward cache).
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) engine.forceStop();
  });
}

/** Language landing pages set <body data-ocr-lang="hin"> to preselect their language. */
function applyDefaultLanguage() {
  const preset = document.body.dataset.ocrLang;
  if (preset && Object.prototype.hasOwnProperty.call(LANGUAGES, preset)
    && el.language.querySelector(`option[value="${preset}"]`)) {
    el.language.value = preset;
  }
  applyOutputLanguage(el.language.value);
}

function init() {
  initThemeToggle($('theme-toggle'));
  applyDefaultLanguage();
  if (el.year) el.year.textContent = String(new Date().getFullYear());
  bindEvents();
  initDragAndDrop();
  initPaste();
  setEmptyState('default');
  render();
}

init();

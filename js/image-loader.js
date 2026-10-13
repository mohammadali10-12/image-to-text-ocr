/**
 * Image validation, decoding (including TIFF) and preprocessing for OCR.
 * Everything here runs locally in the browser.
 *
 * Memory strategy: decoded pixels are never kept for queued images. Each item keeps
 * only its File plus small JPEG thumbnails/previews; full pixels are decoded on demand
 * (already scaled down where the browser supports it) and released straight after use.
 */
import { loadScript, getExtension } from './utils.js';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES = 10;
/** Images above this pixel count are refused before decoding (protects against decompression bombs). */
export const MAX_PIXELS = 50_000_000; // 50 megapixels
/** Longest side (px) sent to OCR. Larger images are scaled down to protect memory. */
export const MAX_OCR_DIMENSION = 4000;
const PREVIEW_DIMENSION = 1400;
const THUMB_DIMENSION = 96;
const HEADER_BYTES = 512 * 1024;

const FORMAT_LABEL = 'JPG, PNG, WebP, BMP, GIF or TIFF';
const EXT_TO_FORMAT = {
  jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', bmp: 'bmp', gif: 'gif', tif: 'tiff', tiff: 'tiff',
};
const MIME_TO_FORMAT = {
  'image/jpeg': 'jpeg', 'image/pjpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp',
  'image/bmp': 'bmp', 'image/x-ms-bmp': 'bmp', 'image/gif': 'gif', 'image/tiff': 'tiff',
};

const PAKO = {
  src: 'https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako_inflate.min.js',
  integrity: 'sha384-eVEAceNXm4nXk77ToJFE5Yyd50iOqdwXwefI35sH/rqeSTw99+DhTt4CzWZU+xBz',
};
const UTIF = {
  src: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js',
  integrity: 'sha384-RyBmXHdfZ/Uon+ud+/AqSyWpUWnKYt2tkRG/P4gWoRUGDU+qIAV3tGBPNlYTBZEF',
};

export class ImageError extends Error {}

/**
 * Quick checks on name, MIME type and size. Returns an error message, or null.
 * The real format is confirmed later from the file's bytes (see inspectFile).
 */
export function validateFile(file) {
  const ext = getExtension(file.name);
  const type = file.type || '';
  const mimeOk = Object.prototype.hasOwnProperty.call(MIME_TO_FORMAT, type);
  const extOk = Object.prototype.hasOwnProperty.call(EXT_TO_FORMAT, ext);
  const genericType = type === '' || type === 'application/octet-stream';

  if (!mimeOk && !(extOk && genericType)) {
    if (type === 'image/svg+xml' || ext === 'svg') return `SVG images are not supported. Please use ${FORMAT_LABEL}.`;
    if (type === 'image/heic' || type === 'image/heif' || ext === 'heic' || ext === 'heif') return 'HEIC/HEIF photos are not supported. Please convert to JPG or PNG first.';
    if (type === 'application/pdf' || ext === 'pdf') return 'PDF files are not supported. Please export the page as an image (JPG or PNG).';
    return `This file type is not supported. Please use ${FORMAT_LABEL}.`;
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'This file is larger than the 10 MB limit.';
  return null;
}

/* ------------------------------------------------------------------ */
/* Header sniffing: real format + dimensions without decoding pixels   */
/* ------------------------------------------------------------------ */

function sniffFormat(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.length >= 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00)
    || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a))) return 'tiff';
  return null;
}

function jpegSize(b, view) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i += 1; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = view.getUint16(i + 2);
    // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

function readDimensions(format, b) {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    switch (format) {
      case 'png': return { width: view.getUint32(16), height: view.getUint32(20) };
      case 'gif': return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
      case 'bmp': return { width: Math.abs(view.getInt32(18, true)), height: Math.abs(view.getInt32(22, true)) };
      case 'jpeg': return jpegSize(b, view);
      case 'webp': {
        const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
        if (chunk === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
        if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
        if (chunk === 'VP8L') {
          const bits = view.getUint32(21, true);
          return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
        }
        return null;
      }
      default: return null; // TIFF dimensions are read by the TIFF decoder
    }
  } catch {
    return null;
  }
}

function checkPixelLimit(width, height) {
  if (!width || !height) throw new ImageError('This image appears to be empty or damaged.');
  if (width * height > MAX_PIXELS) {
    const mp = ((width * height) / 1e6).toFixed(0);
    throw new ImageError(`This image is too large to process safely in a browser (${width.toLocaleString()} × ${height.toLocaleString()} px, ${mp} MP). The limit is 50 megapixels — please resize it first.`);
  }
}

/**
 * Confirms from the file's own bytes that it is a supported image and returns
 * { format, width, height } (width/height may be null for TIFF until decoded).
 */
export async function inspectFile(file) {
  let bytes;
  try {
    bytes = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  } catch {
    throw new ImageError('This file could not be read.');
  }
  const format = sniffFormat(bytes);
  if (!format) throw new ImageError(`This file is not a valid ${FORMAT_LABEL} image (its contents do not match an image format).`);
  const dims = readDimensions(format, bytes);
  if (dims) checkPixelLimit(dims.width, dims.height);
  return { format, width: dims ? dims.width : null, height: dims ? dims.height : null };
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

async function loadTiffDecoder() {
  try {
    await loadScript(PAKO.src, PAKO.integrity); // needed for Deflate-compressed TIFFs
    await loadScript(UTIF.src, UTIF.integrity);
  } catch {
    throw new ImageError('The TIFF decoder could not be downloaded. Check your connection and try again.');
  }
  if (!window.UTIF) throw new ImageError('The TIFF decoder failed to start.');
  return window.UTIF;
}

async function decodeTiff(file) {
  const UTIFLib = await loadTiffDecoder();
  const buffer = await file.arrayBuffer();
  let ifds;
  try {
    ifds = UTIFLib.decode(buffer);
  } catch {
    throw new ImageError('This TIFF file could not be read. It may be damaged or use an unsupported compression.');
  }
  const page = ifds && ifds.find((ifd) => ifd.t256 && ifd.t257);
  if (!page) throw new ImageError('This TIFF file does not contain a readable image.');
  checkPixelLimit(page.t256[0], page.t257[0]);

  try {
    UTIFLib.decodeImage(buffer, page, ifds);
    const { width, height } = page;
    if (!width || !height) throw new Error('empty');
    const rgba = UTIFLib.toRGBA8(page);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, width * height * 4), width, height), 0, 0);
    page.data = null;
    return canvas;
  } catch (err) {
    if (err instanceof ImageError) throw err;
    throw new ImageError('This TIFF file uses a format that cannot be decoded in the browser. Please convert it to PNG or JPG.');
  }
}

function decodeWithImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError('This image could not be opened. It may be damaged or not a real image file.'));
    };
    img.src = url;
  });
}

/** Target size for a decode so the longest side is at most maxDimension (rotation is irrelevant here). */
function fitWithin(width, height, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Decodes a file into a drawable source. When the size is known, browsers that support
 * createImageBitmap resize options decode straight to the smaller size.
 * Returns { source, width, height } where width/height are the ORIGINAL image dimensions.
 */
export async function decodeImage(file, { format, width = null, height = null, maxDimension = null } = {}) {
  let source;
  if (format === 'tiff') {
    try {
      source = await createImageBitmap(file); // Safari decodes TIFF natively
    } catch {
      source = await decodeTiff(file);
    }
  } else if (typeof createImageBitmap === 'function') {
    if (maxDimension && width && height && Math.max(width, height) > maxDimension) {
      const target = fitWithin(width, height, maxDimension);
      try {
        source = await createImageBitmap(file, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'high' });
      } catch {
        source = null; // resize options unsupported: fall back to a full decode
      }
    }
    if (!source) {
      try {
        source = await createImageBitmap(file);
      } catch {
        source = await decodeWithImageElement(file);
      }
    }
  } else {
    source = await decodeWithImageElement(file);
  }

  const decodedW = source.width || source.naturalWidth;
  const decodedH = source.height || source.naturalHeight;
  if (!decodedW || !decodedH) {
    releaseSource(source);
    throw new ImageError('This image appears to be empty.');
  }
  return { source, width: width || decodedW, height: height || decodedH };
}

export function releaseSource(source) {
  if (!source) return;
  if (typeof source.close === 'function') source.close();
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    source.width = 0;
    source.height = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/** Stretches contrast on a grayscale copy of the canvas, ignoring the extreme 1% of pixels. */
function enhanceCanvas(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const histogram = new Uint32Array(256);
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    // Composite transparent pixels on white, then convert to luminance.
    const alpha = data[i + 3] / 255;
    const r = data[i] * alpha + 255 * (1 - alpha);
    const g = data[i + 1] * alpha + 255 * (1 - alpha);
    const b = data[i + 2] * alpha + 255 * (1 - alpha);
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    data[i] = lum;
    histogram[lum] += 1;
  }

  const cutoff = total * 0.01;
  let low = 0;
  let high = 255;
  for (let acc = 0; low < 255 && acc + histogram[low] < cutoff; low += 1) acc += histogram[low];
  for (let acc = 0; high > 0 && acc + histogram[high] < cutoff; high -= 1) acc += histogram[high];
  const range = Math.max(1, high - low);

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.max(0, Math.min(255, ((data[i] - low) * 255) / range));
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Draws the source with rotation, optional enhancement and a maximum size.
 * Returns a canvas.
 */
export function renderToCanvas(source, { rotation = 0, enhance = false, maxDimension = MAX_OCR_DIMENSION } = {}) {
  const srcWidth = source.width || source.naturalWidth;
  const srcHeight = source.height || source.naturalHeight;
  const quarterTurns = (((rotation % 360) + 360) % 360) / 90;
  const swap = quarterTurns % 2 === 1;
  const { width: drawW, height: drawH } = fitWithin(srcWidth, srcHeight, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = swap ? drawH : drawW;
  canvas.height = swap ? drawW : drawH;
  const ctx = canvas.getContext('2d', { willReadFrequently: enhance });
  if (!ctx) throw new ImageError('Your browser could not allocate memory for this image. Try a smaller image or close other tabs.');

  // White background so transparent PNGs keep dark text readable.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((quarterTurns * Math.PI) / 2);
  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (enhance) enhanceCanvas(ctx, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ImageError('The image could not be prepared. It may be too large for your device — try a smaller image or close other tabs.'));
    }, type, quality);
  });
}

function freeCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

/** Decodes `item.file` at (at most) maxDimension, runs `work(source)`, and always releases the pixels. */
async function withDecoded(item, maxDimension, work) {
  const { source } = await decodeImage(item.file, { format: item.format, width: item.width, height: item.height, maxDimension });
  try {
    return await work(source);
  } finally {
    releaseSource(source);
  }
}

async function renderBlob(source, options, type, quality) {
  const canvas = renderToCanvas(source, options);
  try {
    return await canvasToBlob(canvas, type, quality);
  } finally {
    freeCanvas(canvas);
  }
}

/**
 * Prepares a newly added item: confirms dimensions and creates its thumbnail.
 * No decoded pixels are retained afterwards.
 */
export async function prepareItem(item) {
  const { source, width, height } = await decodeImage(item.file, {
    format: item.format, width: item.width, height: item.height, maxDimension: PREVIEW_DIMENSION,
  });
  try {
    item.width = width;
    item.height = height;
    checkPixelLimit(width, height);
    const thumb = await renderBlob(source, { rotation: item.rotation, maxDimension: THUMB_DIMENSION }, 'image/jpeg', 0.8);
    item.thumbUrl = URL.createObjectURL(thumb);
  } finally {
    releaseSource(source);
  }
}

export async function makePreviewUrl(item, enhance) {
  const blob = await withDecoded(item, PREVIEW_DIMENSION, (source) => renderBlob(source, {
    rotation: item.rotation, enhance, maxDimension: PREVIEW_DIMENSION,
  }, 'image/jpeg', 0.88));
  return URL.createObjectURL(blob);
}

export async function makeThumbUrl(item) {
  const blob = await withDecoded(item, PREVIEW_DIMENSION, (source) => renderBlob(source, {
    rotation: item.rotation, maxDimension: THUMB_DIMENSION,
  }, 'image/jpeg', 0.8));
  return URL.createObjectURL(blob);
}

/** Produces the PNG blob that is passed to the OCR engine. */
export function prepareForOcr(item, enhance) {
  return withDecoded(item, MAX_OCR_DIMENSION, (source) => renderBlob(source, {
    rotation: item.rotation, enhance, maxDimension: MAX_OCR_DIMENSION,
  }, 'image/png'));
}

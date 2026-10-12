/**
 * Image validation, decoding (including TIFF) and preprocessing for OCR.
 * Everything here runs locally in the browser.
 */
import { loadScript, getExtension } from './utils.js';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES = 10;
/** Longest side (px) sent to OCR. Larger images are scaled down to protect memory. */
export const MAX_OCR_DIMENSION = 4000;
const PREVIEW_DIMENSION = 1400;
const THUMB_DIMENSION = 96;

const FORMATS = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  bmp: 'image/bmp',
  gif: 'image/gif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};
const ACCEPTED_MIME = new Set([...Object.values(FORMATS), 'image/x-ms-bmp', 'image/pjpeg']);

const PAKO_URL = 'https://cdn.jsdelivr.net/npm/pako@1.0.11/dist/pako_inflate.min.js';
const UTIF_URL = 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js';

export class ImageError extends Error {}

function isTiff(file) {
  const ext = getExtension(file.name);
  return file.type === 'image/tiff' || ext === 'tif' || ext === 'tiff';
}

/**
 * Checks type and size. Returns an error message, or null when the file is acceptable.
 * Some systems report an empty MIME type, so the extension is used as a fallback.
 */
export function validateFile(file) {
  const ext = getExtension(file.name);
  const type = file.type || '';
  const mimeOk = ACCEPTED_MIME.has(type);
  const extOk = Object.prototype.hasOwnProperty.call(FORMATS, ext);
  const genericType = type === '' || type === 'application/octet-stream';

  if (!mimeOk && !(extOk && genericType)) {
    if (file.type === 'image/svg+xml' || ext === 'svg') return 'SVG images are not supported. Please use JPG, PNG, WebP, BMP, GIF or TIFF.';
    if (file.type === 'image/heic' || ext === 'heic' || ext === 'heif') return 'HEIC/HEIF photos are not supported. Please convert to JPG or PNG first.';
    if (file.type === 'application/pdf' || ext === 'pdf') return 'PDF files are not supported. Please export the page as an image (JPG or PNG).';
    return 'This file type is not supported. Please use JPG, PNG, WebP, BMP, GIF or TIFF.';
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'This file is larger than the 10 MB limit.';
  return null;
}

async function decodeTiff(file) {
  try {
    await loadScript(PAKO_URL); // needed for Deflate-compressed TIFFs
    await loadScript(UTIF_URL);
  } catch {
    throw new ImageError('The TIFF decoder could not be downloaded. Check your connection and try again.');
  }
  const UTIF = window.UTIF;
  if (!UTIF) throw new ImageError('The TIFF decoder failed to start.');

  const buffer = await file.arrayBuffer();
  let ifds;
  try {
    ifds = UTIF.decode(buffer);
  } catch {
    throw new ImageError('This TIFF file could not be read. It may be damaged or use an unsupported compression.');
  }
  const page = ifds && ifds.find((ifd) => ifd.t256 && ifd.t257);
  if (!page) throw new ImageError('This TIFF file does not contain a readable image.');

  try {
    UTIF.decodeImage(buffer, page, ifds);
    const width = page.width;
    const height = page.height;
    if (!width || !height) throw new Error('empty');
    const rgba = UTIF.toRGBA8(page);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, width * height * 4), width, height), 0, 0);
    return canvas;
  } catch {
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

/**
 * Decodes a file into a drawable source (ImageBitmap, canvas or <img>).
 * Returns { source, width, height }.
 */
export async function decodeImage(file) {
  let source;
  if (isTiff(file)) {
    // Safari can decode TIFF natively; other browsers need UTIF.
    try {
      source = await createImageBitmap(file);
    } catch {
      source = await decodeTiff(file);
    }
  } else if (typeof createImageBitmap === 'function') {
    try {
      source = await createImageBitmap(file);
    } catch {
      source = await decodeWithImageElement(file);
    }
  } else {
    source = await decodeWithImageElement(file);
  }

  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;
  if (!width || !height) throw new ImageError('This image appears to be empty.');
  return { source, width, height };
}

export function releaseSource(source) {
  if (source && typeof source.close === 'function') source.close();
  if (source instanceof HTMLCanvasElement) {
    source.width = 0;
    source.height = 0;
  }
}

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
export function renderToCanvas(source, srcWidth, srcHeight, { rotation = 0, enhance = false, maxDimension = MAX_OCR_DIMENSION } = {}) {
  const quarterTurns = ((rotation % 360) + 360) % 360 / 90;
  const swap = quarterTurns % 2 === 1;
  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
  const drawW = Math.max(1, Math.round(srcWidth * scale));
  const drawH = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = swap ? drawH : drawW;
  canvas.height = swap ? drawW : drawH;
  const ctx = canvas.getContext('2d', { willReadFrequently: enhance });
  if (!ctx) throw new ImageError('Your browser could not allocate memory for this image. Try a smaller image.');

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
      else reject(new ImageError('The image could not be prepared. It may be too large for your device.'));
    }, type, quality);
  });
}

export async function makePreviewUrl(item, enhance) {
  const canvas = renderToCanvas(item.source, item.width, item.height, {
    rotation: item.rotation,
    enhance,
    maxDimension: PREVIEW_DIMENSION,
  });
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
  canvas.width = 0;
  canvas.height = 0;
  return URL.createObjectURL(blob);
}

export async function makeThumbUrl(item) {
  const canvas = renderToCanvas(item.source, item.width, item.height, {
    rotation: item.rotation,
    maxDimension: THUMB_DIMENSION,
  });
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
  canvas.width = 0;
  canvas.height = 0;
  return URL.createObjectURL(blob);
}

/** Produces the PNG blob that is passed to the OCR engine. */
export async function prepareForOcr(item, enhance) {
  const canvas = renderToCanvas(item.source, item.width, item.height, {
    rotation: item.rotation,
    enhance,
    maxDimension: MAX_OCR_DIMENSION,
  });
  const blob = await canvasToBlob(canvas, 'image/png');
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

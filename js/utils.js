/** Small shared helpers. */

const scriptCache = new Map();

/**
 * Loads a classic script once and resolves when it has executed.
 * Failed loads are not cached so they can be retried.
 */
export function loadScript(src) {
  if (scriptCache.has(src)) return scriptCache.get(src);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      script.remove();
      scriptCache.delete(src);
      reject(new Error(`Could not load ${src}`));
    });
    document.head.appendChild(script);
  });

  scriptCache.set(src, promise);
  return promise;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function getExtension(name) {
  const match = /\.([a-z0-9]+)$/i.exec(name || '');
  return match ? match[1].toLowerCase() : '';
}

export function stripExtension(name) {
  return (name || '').replace(/\.[^.]+$/, '');
}

/** Produces a filesystem-friendly base name. */
export function safeFileBase(name) {
  const cleaned = stripExtension(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'extracted-text';
}

export function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/u).length;
}

/** Counts user-perceived characters (handles emoji and combining marks reasonably). */
export function countCharacters(text) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    let count = 0;
    // eslint-disable-next-line no-unused-vars
    for (const _ of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) count += 1;
    return count;
  }
  return Array.from(text).length;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

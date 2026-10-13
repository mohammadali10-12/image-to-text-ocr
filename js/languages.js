/**
 * OCR languages offered in the UI.
 * `code` is the Tesseract language code, `bcp47` the HTML lang tag, `dir` the text direction.
 */
export const LANGUAGES = Object.freeze({
  eng: { name: 'English', bcp47: 'en', dir: 'ltr' },
  hin: { name: 'Hindi', bcp47: 'hi', dir: 'ltr' },
  guj: { name: 'Gujarati', bcp47: 'gu', dir: 'ltr' },
  urd: { name: 'Urdu', bcp47: 'ur', dir: 'rtl' },
  mar: { name: 'Marathi', bcp47: 'mr', dir: 'ltr' },
  ben: { name: 'Bengali', bcp47: 'bn', dir: 'ltr' },
  tam: { name: 'Tamil', bcp47: 'ta', dir: 'ltr' },
  tel: { name: 'Telugu', bcp47: 'te', dir: 'ltr' },
  ara: { name: 'Arabic', bcp47: 'ar', dir: 'rtl' },
  spa: { name: 'Spanish', bcp47: 'es', dir: 'ltr' },
  fra: { name: 'French', bcp47: 'fr', dir: 'ltr' },
  deu: { name: 'German', bcp47: 'de', dir: 'ltr' },
  ita: { name: 'Italian', bcp47: 'it', dir: 'ltr' },
  por: { name: 'Portuguese', bcp47: 'pt', dir: 'ltr' },
  rus: { name: 'Russian', bcp47: 'ru', dir: 'ltr' },
  chi_sim: { name: 'Chinese (Simplified)', bcp47: 'zh-Hans', dir: 'ltr' },
  jpn: { name: 'Japanese', bcp47: 'ja', dir: 'ltr' },
});

export function languageInfo(code) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, code) ? LANGUAGES[code] : LANGUAGES.eng;
}

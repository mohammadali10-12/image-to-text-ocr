# ImageToText OCR

A free, privacy-friendly **image to text converter**. Upload a photo, screenshot or scan, extract the text with OCR that runs entirely in your browser, edit it, then copy it or download it as a `.txt` file.

Built as a static website with plain HTML, CSS and JavaScript — no framework, no build step, no backend.

## Features

- **Upload any way you like** — click to browse, drag and drop, or paste an image with <kbd>Ctrl</kbd>+<kbd>V</kbd>.
- **Batch OCR** — add up to 10 images; they are processed one after another and combined into a single result, with the file name above each section. Progress is shown for the current image and the whole batch.
- **Image preview and tools** — filename, size and dimensions, rotate left/right, replace, remove, and an optional *Enhance image* (grayscale + contrast stretch) pre-processing step.
- **17 OCR languages** — English (default), Hindi, Gujarati, Urdu, Marathi, Bengali, Tamil, Telugu, Arabic, Spanish, French, German, Italian, Portuguese, Russian, Simplified Chinese and Japanese. Language data is downloaded only when that language is used.
- **Live progress** — *Preparing image → Loading OCR engine → Loading language data → Recognizing text → Processing complete*, with percentages.
- **Editable result** — line breaks and paragraph gaps are preserved; character and word counts; Copy (Clipboard API with fallback), Download TXT (named after the original image), Select all, Clear text.
- **Robust error handling** — file type and 10 MB size validation, damaged images, missing language data, engine download failures, Retry for failed images, and Cancel during processing.
- **Light and dark mode** — light by default; your choice is remembered in your browser.
- **Responsive and accessible** — works on phones, tablets and desktops; keyboard operable, visible focus states, labelled controls and live status messages.

## Technologies

- HTML5, CSS3 (custom properties for theming), vanilla JavaScript (ES modules)
- [Tesseract.js](https://github.com/naptha/tesseract.js) **7.0.0** (WebAssembly OCR engine), loaded from the jsDelivr CDN
- [UTIF.js](https://github.com/photopea/UTIF.js) 3.1.0 + pako 1.0.11 — loaded only when a TIFF file needs to be decoded
- Hosted on Vercel as a static site

## Project structure

```text
image-to-text-ocr/
├── index.html                    # Homepage: converter + how-to, languages, formats, tips, FAQ
├── hindi-image-to-text.html      # Language guides with the converter preselected
├── gujarati-image-to-text.html   #   (<body data-ocr-lang="…">)
├── urdu-image-to-text.html
├── about.html, contact.html, privacy.html, terms.html
├── 404.html                      # Served by Vercel for unknown URLs (noindex)
├── robots.txt, sitemap.xml
├── favicon.ico
├── css/style.css                 # All styles, light/dark tokens, responsive rules
├── js/
│   ├── theme-init.js             # Applies the saved theme before first paint
│   ├── app.js                    # Converter UI: uploads, queue, OCR runs, text actions
│   ├── ocr-engine.js             # Lazy Tesseract.js loading (SRI) and worker lifecycle
│   ├── image-loader.js           # Validation (magic bytes, pixel limit), on-demand decoding, TIFF
│   ├── languages.js              # OCR language → HTML lang/dir mapping
│   ├── theme.js                  # Light/dark toggle
│   ├── site.js                   # Theme toggle + year for pages without the converter
│   └── utils.js                  # Script loader, formatting, counting
├── assets/                       # favicon.svg, apple-touch-icon.png, og-image.jpg
├── docs/                         # Audit report, SEO keyword map, Search Console, AdSense, load testing
├── vercel.json                   # Clean URLs, security headers, caching
├── .vercelignore                 # Keeps README.md and docs/ off the public site
└── README.md
```

The header, footer and converter markup are repeated in each page that uses them (there is no build step). When you change one of them, apply the same change to `index.html` and the three language pages.

The production URL `https://image-to-text-ocr-ten.vercel.app` is written into canonical tags, Open Graph tags, JSON-LD, `robots.txt` and `sitemap.xml`. If you move to a custom domain, search the repository for it and replace every occurrence.

## How the OCR works

1. When you add an image it is validated (type and size) and decoded **in your browser** (`createImageBitmap`, or UTIF.js for TIFF).
2. When you click **Extract text**, the image is drawn to a canvas with your rotation and optional enhancement applied. Images larger than 4,000 px on the longest side are scaled down to protect memory.
3. Tesseract.js is loaded on first use. It starts a Web Worker, downloads the WebAssembly engine and the trained data for the selected language, and recognizes the text — the page stays responsive while it works.
4. The result is rebuilt from Tesseract's line layout so paragraph gaps are kept, then placed in the editor.
5. The worker is reused for later images in the same language, replaced when you switch language, and terminated when you clear the workspace or leave the page.

## Supported image formats

| Format | Notes |
| --- | --- |
| JPG / JPEG, PNG, WebP, BMP | Decoded natively by the browser |
| GIF | First frame only |
| TIFF / TIF | First page; decoded in the browser with UTIF.js (common compressions such as uncompressed, LZW, PackBits and Deflate; some unusual TIFF variants may fail and should be converted to PNG) |

Limits: 10 MB and 50 megapixels per file, 10 images per batch. The real format is checked from the file's contents, not just its name. SVG, HEIC and PDF are not supported.

## Language support and limitations

Trained data comes from the [`@tesseract.js-data`](https://github.com/naptha/tessdata) packages (`4.0.0_best_int` models). Downloads range from about 1 MB to 15 MB per language and are cached by your browser after the first use.

OCR is **not 100% accurate**. It works best on clear, printed, upright text with good contrast. Handwriting, stylised fonts, blurry or tiny text, and complex layouts (tables, columns) reduce accuracy. Always review the output.

## Run locally

This is a static site, so any static file server works. Because the app uses ES modules, open it over `http://`, not directly from the file system.

```bash
# Python 3 (pre-installed on most systems)
cd image-to-text-ocr
python3 -m http.server 8080
# then open http://localhost:8080
```

Or open the folder in VS Code and use the **Live Server** extension. Simple servers don't support Vercel's clean URLs, so open the other pages with their `.html` name locally (for example `/about.html`); on Vercel they are served at `/about`. An internet connection is required the first time OCR runs, to download the engine and language data from jsDelivr.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Use these settings:
   - Framework preset: **Other**
   - Build command: *(none)*
   - Output directory: *(project root)*
   - Install command: *(none)*
4. Deploy. Every push to `main` triggers a new production deployment.

`vercel.json` enables clean URLs (`/about` instead of `/about.html`), adds security headers (Content-Security-Policy allowing only this site and `cdn.jsdelivr.net`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS) and short caching for CSS/JS. Scripts loaded from jsDelivr are pinned to exact versions, and the main library and TIFF decoder are checked with Subresource Integrity hashes.

> **Commercial use:** Vercel's Hobby plan is for non-commercial use only, and advertising (including Google AdSense) counts as commercial use. See `docs/ADSENSE.md` before adding ads.

See `docs/SEARCH-CONSOLE.md` for Google Search Console setup.

## Privacy

- Images and extracted text are processed locally in your browser and are **never uploaded** to this site's server or any OCR service.
- The only network requests are for the site's own files and the open-source OCR library, engine and language data from `cdn.jsdelivr.net` (plus the TIFF decoder if you open a TIFF). jsDelivr receives standard request information (such as your IP address) when serving these files.
- No analytics or trackers. The site loads the Google AdSense script (see `docs/ADSENSE.md`), which may set advertising cookies; the site's own code sets none. The only thing the site itself stores is your light/dark theme choice (in `localStorage`). Tesseract.js also caches downloaded language data in your browser's IndexedDB to speed up later runs.

## Known limitations

- An internet connection is needed the first time each language is used; offline use is not supported or tested.
- Multi-page TIFFs: only the first page is processed. Animated GIFs: only the first frame.
- Very large or numerous images can be slow on low-memory phones.
- For some languages (e.g. Hindi, Gujarati) Tesseract prints harmless "Parameter not found" warnings to the browser console.
- Mixed-language images should be processed once per language.

## License

The site code is provided as-is for personal and commercial use. Tesseract.js and Tesseract are licensed under Apache 2.0; UTIF.js under MIT; pako under MIT/Zlib.

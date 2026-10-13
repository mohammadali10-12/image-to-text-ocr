# ImageToText OCR — SEO, performance, security & AdSense audit

Date: 13 October 2026 · Site: https://image-to-text-ocr-ten.vercel.app · Repo: `mohammadali10-12/image-to-text-ocr` (`main`, base commit `b0fdec5`)

Status labels: ✅ **Completed and verified** (tested locally) · 🟡 **Implemented, not independently verified** · 👤 **Requires your action** · ⛔ **Not implemented** (with reason)

> **Verification scope.** All tests ran against the repository served locally by a server that mimics Vercel (clean URLs, `vercel.json` headers, 404 page) in headless Chromium 141, with the jsDelivr files replaced by byte-identical npm copies (SHA-256 matched jsDelivr's published hashes). The audit environment could not reach the production domain directly (a web fetch confirmed the homepage loads and matches commit `b0fdec5`). The Vercel connection could not see the `image-to-text-ocr` project, so the project settings could not be inspected.

## 1. Problems found (before changes)

| Priority | Finding |
| --- | --- |
| Critical | **Browser memory:** every queued image kept full decoded pixels. Measured: 10 × 27 MP photos raised browser memory from 0.4 GB to 1.8 GB — enough to crash many phones. |
| Critical | **Decompression bomb:** a 76 KB PNG with 20,000 × 20,000 pixels (400 MP) was accepted and decoded (≈2 GB). |
| Critical (business) | **Vercel Hobby forbids ads:** Vercel's fair-use rules list Google AdSense as commercial use, which Hobby does not allow. |
| High | No `robots.txt`, `sitemap.xml`, canonical URLs, Open Graph image, Twitter card or structured data. |
| High | No Privacy Policy, Terms, Contact or About pages (needed for trust and AdSense review). |
| High | Unknown URLs got Vercel's default 404 page. |
| High | File type checked only by name/MIME, not by contents. |
| Medium | Lighthouse accessibility 93: low-contrast footnote (3.17:1), file input without label, dropzone name mismatch. |
| Medium | Output editor didn't set language/direction (Urdu/Arabic should be RTL). |
| Medium | CDN scripts had pinned versions but no Subresource Integrity. |
| Medium | `README.md` was publicly served from the site. |
| Low | One `target="_blank"` link without `noreferrer`; no `favicon.ico` (browser 404 noise); modules loaded as a 2-level waterfall. |
| Info | No unsafe DOM APIs (`innerHTML`, `eval`, `document.write`) found; `npm audit` of tesseract.js 7.0.0, tesseract.js-core 7.0.0, utif 3.1.0, pako 1.0.11: **0 vulnerabilities**. No secrets in the repo. |

## 2–7. Changes implemented

### SEO ✅
- Homepage title `Image to Text Converter – Free Online OCR | ImageToText OCR`, accurate description, H1 "Free Image to Text Converter".
- Unique titles/descriptions, one H1, self-canonical, Open Graph + Twitter card (1200×630 `og-image.jpg`), favicon set on all 8 indexable pages.
- `robots.txt` (allow all + sitemap), `sitemap.xml` (8 canonical URLs, no fabricated `lastmod`), custom `404.html` (noindex, real 404 status via Vercel).
- JSON-LD: `WebSite` + `WebApplication` (free offer, feature list, **no ratings/reviews**); `WebPage` + `BreadcrumbList` on language pages; `BreadcrumbList` on content pages. FAQPage markup intentionally **not** added (Google limits FAQ rich results to authoritative government/health sites).
- New homepage content: 4-step how-to, supported-language list (with measured download sizes), formats & accuracy factors, tips, use cases, "Private by design", 9-question FAQ, crawlable footer links.
- Language pages `/hindi-image-to-text`, `/gujarati-image-to-text`, `/urdu-image-to-text`: the working converter with the language preselected, plus unique script-specific guidance (Devanagari shirorekha/matras, Gujarati marks, Urdu Naskh vs Nastaliq and RTL, Unicode vs legacy fonts). Each was OCR-tested before publishing.
- Keyword map: `docs/SEO-KEYWORDS.md` (hypotheses, not validated).

### Performance ✅
- Images are decoded on demand at reduced size (`createImageBitmap` resize options, with fallback) and released immediately. Measured: 10 × 27 MP photos now add **≈74 MB** (was ≈1.4 GB).
- 50 MP limit checked from the file header *before* decoding; the 400 MP bomb is refused with a clear message.
- `modulepreload` for JS modules; `favicon.ico` added; caching headers for icons, robots and sitemap.
- Lighthouse (mobile, local): every page 99–100 performance, **100 accessibility**, 100 best practices, 100 SEO; CLS 0; TBT 0 ms. Homepage first visit ≈38 KB gzip.
- OCR resources still load only when the first image is added (verified: no CDN requests on page load).

### Security ✅
- Real file format verified from magic bytes (JPEG, PNG, GIF, WebP, BMP, TIFF); renamed non-images rejected.
- Subresource Integrity on `tesseract.min.js`, `UTIF.js`, `pako_inflate.min.js` (hashes verified against jsDelivr). The worker and WebAssembly core are loaded by Tesseract.js inside the worker and cannot carry SRI; they are pinned to exact versions.
- All `target="_blank"` links use `rel="noopener noreferrer"`; `.vercelignore` keeps `README.md` and `docs/` off the public site.
- Existing CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP and HSTS kept; verified compatible with OCR and JSON-LD (no CSP violations in any test).
- Filenames, OCR output and messages continue to use `textContent` only; no document contents are logged.

### Accessibility & UX ✅
- Contrast fixed (all text ≥ 4.5:1 in light and dark themes, computed); file input labelled; dropzone accessible name matches its text.
- Output editor gets the OCR language's `lang` and `dir` (Urdu/Arabic → RTL; verified).
- Duplicate files are skipped with a message; memory failures show a plain-language message.
- Responsive layout verified at 320, 360, 375, 820 and 1366 px with no horizontal scrolling.

### AdSense readiness 🟡 / 👤
- About, Contact (GitHub Issues), Privacy Policy and Terms pages written to match the real implementation (no company name, address or legal status invented).
- Hidden, labelled ad positions reserved away from converter controls (no space, no requests until enabled).
- Full enablement guide (CSP changes, `ads.txt` template, consent message, privacy text): `docs/ADSENSE.md`. **No ad code or `ads.txt` added** — there is no publisher ID.

## 8. Tests executed (real results)

| Suite | Result |
| --- | --- |
| Functional regression (upload JPG/PNG/WebP/BMP/TIFF-LZW/TIFF-Deflate, invalid/oversized/corrupt files, drag-drop, paste, replace, remove, rotate, duplicates, batch of 3 with progress, blank image, Spanish, missing-language error + retry, edit, counts, copy, TXT download content + filename, select all, overwrite confirmation, cancel, clear all, keyboard, dark mode persistence, no third-party requests, no console errors, mobile/tablet overflow) | **50 / 50 passed** |
| SEO & crawl (robots, sitemap XML, redirects `/index.html`→`/`, trailing slash, `.html`→clean URL, 404 status + noindex, per-page title/description length + uniqueness, single H1, heading order, canonical, OG, Twitter, JSON-LD parse, img alt, `noopener noreferrer`, language preselect, 360 px mobile overflow, 124 internal links incl. #fragments, console errors) | **128 / 128 passed** |
| OCR by language (Hindi, Gujarati, Urdu on rendered sample text) | Exact matches; Urdu editor `lang=ur dir=rtl` |
| Large images (3 × 6000×4500 JPEG, plus extra Extract click and file add during run) | 150/150 lines recognized, 28 s, peak browser RSS ≈0.9 GB; extra actions safely ignored |
| Memory (10 × 27 MP) and 400 MP bomb | +74 MB; bomb rejected before decode |
| Lighthouse mobile, 8 pages | 99–100 in all categories (one run had to be repeated after a Lighthouse trace error) |
| `node --check` on all JS, HTML parse, `xmllint` sitemap, `npm audit` | All passed / 0 vulnerabilities |

## 9. Tests not executed

- **Production checks after deployment** — not deployed yet (awaiting your approval), and this environment cannot reach the production domain from a browser.
- **Google Rich Results Test / Schema validator** — requires Google's online tool; JSON-LD was only syntax-checked.
- **Real devices** (iPhone Safari, low-end Android) and **Safari/Firefox** — only Chromium was available. TIFF in Safari and the `createImageBitmap` resize fallback are untested.
- **Live jsDelivr CDN** — replaced by identical local files in tests.
- **Load testing** — Vercel permits load tests only on Enterprise plans with approval; see `docs/LOAD-TESTING.md`.
- **Handwriting and Urdu Nastaliq** accuracy — no suitable test material; documented as limitations.

## 10. Remaining risks

- Ads cannot legally run on the current Vercel Hobby plan.
- OCR depends on jsDelivr; if it is unavailable, extraction fails (with a retry message).
- The shared header, footer and converter markup is duplicated in 4 pages (no build step) — edit them together.
- Canonicals point to `image-to-text-ocr-ten.vercel.app`; a future custom domain requires updating them.
- Rankings, traffic and AdSense approval are not guaranteed.

## 11. External services and credentials you need

- **Vercel:** decide on Pro (or another host) before ads; confirm the project is connected to the GitHub repo for auto-deploys (could not be inspected).
- **Google Search Console** access (see `docs/SEARCH-CONSOLE.md`).
- **AdSense** account and publisher ID, and a contact email (optional but recommended).

## 12. Deployment steps

1. Review the changed files, then commit and push to `main` (awaiting approval).
2. If the Vercel project is Git-connected, it deploys automatically; otherwise run a deploy from the Vercel dashboard.
3. Post-deployment checklist (in a browser):
   - `/`, `/hindi-image-to-text`, `/gujarati-image-to-text`, `/urdu-image-to-text`, `/about`, `/contact`, `/privacy`, `/terms` load; `/does-not-exist` shows the custom 404.
   - `/robots.txt` and `/sitemap.xml` load; `/README.md` returns 404.
   - On the homepage, extract text from a screenshot, then copy and download it; on the Urdu page confirm the text is right-to-left.
   - DevTools → Console shows no errors; Network shows only this site and `cdn.jsdelivr.net`.
   - Response headers include `Content-Security-Policy`.

## 13–14. Search Console & AdSense

See `docs/SEARCH-CONSOLE.md` and `docs/ADSENSE.md`.

## 15. Next 30 days

| Week | Actions |
| --- | --- |
| 1 | Deploy; verify Search Console; submit sitemap; request indexing for the 4 main pages; test on your own phone. |
| 2 | Decide hosting plan (Pro vs. another host) and whether to buy a custom domain *before* building links (changing domains later costs time). Add a contact email. |
| 3 | Share the tool where it is genuinely useful (relevant communities, your portfolio, GitHub README) — no paid or spam backlinks. Watch Search Console → Pages for indexing problems. |
| 4 | Read Search Console queries; update `docs/SEO-KEYWORDS.md`; improve titles for pages with impressions but few clicks; consider a new language page only where real demand shows. Apply to AdSense once hosting allows ads and pages are indexed. |

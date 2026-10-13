# Traffic, capacity and load-testing plan

## Where the work happens

| Operation | Runs on | Cost to you |
| --- | --- | --- |
| Serving HTML, CSS, JS, icons | Vercel CDN (static files, no serverless functions) | Counts toward Vercel Fast Data Transfer and edge requests |
| OCR engine (≈4 MB) and language data (≈1–3 MB per language) | jsDelivr public CDN → visitor's browser | None to Vercel; depends on jsDelivr's availability |
| Image decoding, OCR, text editing | Visitor's device (Web Worker + WebAssembly) | None — no server CPU |

There is **no backend, database, queue or serverless function**, so there is nothing to rate-limit or exhaust server-side. Traffic spikes mainly affect CDN bandwidth, not compute.

## Measured page weight (gzip, from the repository files)

- Homepage, first visit: about **38 KB** transferred from Vercel (HTML 8 KB, CSS 6 KB, JS modules about 19 KB, icons).
- Repeat visit within an hour: mostly HTML only (about 8 KB); CSS/JS/assets are cached for 1 hour.
- Content pages (About, Privacy, …): about 3 KB HTML plus cached CSS/JS.

**Rough capacity estimate:** Vercel Hobby includes the first 100 GB of Fast Data Transfer per month ([Vercel fair-use table](https://vercel.com/docs/limits/fair-use-guidelines)). At about 40–45 KB per cold homepage visit, that is on the order of **2 million cold page views per month** before bandwidth becomes a concern. This is an estimate, not a guarantee; real numbers depend on caching, bots and protocol overhead. (Remember that Hobby does not allow ads — see `docs/ADSENSE.md`.)

## Third-party dependency risk

OCR depends on `cdn.jsdelivr.net`. If jsDelivr is slow or blocked in a visitor's network (some corporate or regional networks), the page loads but OCR shows an "engine could not be downloaded" error with a Retry button. Mitigation if this becomes a problem: self-host `tesseract.js`, `tesseract.js-core` and the `@tesseract.js-data/*` files on the same origin. This raises your bandwidth use substantially (about 7 MB per first-time OCR user), so measure first.

## Load-testing policy

Vercel only permits load testing on **Enterprise** plans, with prior approval; unapproved tests can breach the fair-use policy and get the source IPs blocked ([Vercel's policy](https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments)). **No load test was run against production, and none should be.**

## Safe plan

1. **Static file server (local or a disposable VM you own):** serve the repository with any static server (for example `npx serve` or nginx) and run a short, capped test, e.g. with [k6](https://k6.io):
   ```js
   // k6 run load.js   (target your OWN test server, never the Vercel URL)
   import http from 'k6/http';
   export const options = { vus: 50, duration: '2m', thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<300'] } };
   export default function () { http.get(__ENV.BASE + '/'); http.get(__ENV.BASE + '/css/style.css'); http.get(__ENV.BASE + '/js/app.js'); }
   ```
   Record requests per second, p95 latency, error rate and bytes transferred. This validates the files and caching headers, not Vercel's capacity.
2. **Client-side OCR capacity** (the real bottleneck is the visitor's device): test on a low-end Android phone and an older iPhone with 1, 5 and 10 typical photos; note time per image and whether the tab reloads (out of memory).
3. **Production monitoring instead of load tests:** watch Vercel → Usage (Fast Data Transfer, edge requests) weekly, and set a spend or usage alert if you move to Pro.

## Browser-side safeguards already implemented

- 10 MB per file, 50 megapixels per image (checked from the file header *before* decoding), 10 images per batch.
- Images are decoded on demand at reduced size and released immediately; queued images keep only small JPEG thumbnails. Measured: adding ten 27-megapixel photos raised browser memory by about 74 MB (previously about 1.4 GB).
- OCR images are capped at 4,000 px on the longest side.
- One OCR worker at a time; duplicate Extract clicks, adding files during a run and duplicate files are handled safely; Cancel terminates the worker.
- Memory-exhaustion failures are reported with a plain-language message and a Retry button.

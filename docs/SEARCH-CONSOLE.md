# Google Search Console setup

Production URL used in canonicals and the sitemap: **https://imgtotextocr.com** (custom domain, registered at Hostinger). The old address `image-to-text-ocr-ten.vercel.app` permanently redirects (308) to it.

> **Recommended now:** add a **Domain** property for `imgtotextocr.com` (verify with a DNS TXT record in Hostinger → DNS records). It covers `https://`, `http://` and `www`. The older URL-prefix property for the vercel.app address can stay; it will show the redirect.

> If you later move to a custom domain, update `SITE` everywhere it appears (canonical, `og:url`, `og:image`, JSON-LD, `robots.txt`, `sitemap.xml`; search the repo for `image-to-text-ocr-ten.vercel.app`), add the domain in Vercel, and set the old `vercel.app` URL to redirect to it. Then add the new domain as a Search Console property.

## 1. Verify ownership

`vercel.app` is a shared domain, so you cannot use a *Domain* property (that requires DNS access). Use a **URL-prefix** property:

1. Go to <https://search.google.com/search-console> → **Add property** → **URL prefix** → enter `https://image-to-text-ocr-ten.vercel.app/`.
2. Choose one verification method:
   - **HTML file (simplest):** download the `googleXXXXXXXX.html` file Google gives you, put it in the repository root, commit and push, wait for Vercel to deploy, then click **Verify**. Keep the file in the repo permanently.
   - **HTML tag:** add the `<meta name="google-site-verification" content="…">` tag to the `<head>` of `index.html`, deploy, then verify.
3. Do not remove the verification file or tag later, or the property becomes unverified.

**Status:** the HTML verification file `googlef8c45f7f8dc0f2f1.html` is in the repository root and is served at `/googlef8c45f7f8dc0f2f1.html` with a 200 response and no redirect (clean URLs are implemented with explicit rewrites in `vercel.json` so `.html` files that aren't site pages are not redirected). Do not delete it.

## 2. Submit the sitemap

1. In the property, open **Indexing → Sitemaps**.
2. Enter `sitemap.xml` and click **Submit**.
3. The status should become *Success* with 8 discovered URLs. If it shows *Couldn't fetch*, open `https://image-to-text-ocr-ten.vercel.app/sitemap.xml` in a browser and confirm it loads.

## 3. Inspect and request indexing

For each important page (`/`, `/hindi-image-to-text`, `/gujarati-image-to-text`, `/urdu-image-to-text`):

1. Paste the full URL into the search bar at the top of Search Console (**URL Inspection**).
2. Click **Test live URL** and then **View tested page → Screenshot / HTML** to confirm Google sees the content.
3. Check that *User-declared canonical* equals the URL itself.
4. Click **Request indexing**. (Requests are rate-limited; indexing is not guaranteed and can take days or weeks.)

## 4. What to watch

- **Indexing → Pages:** look for "Duplicate without user-selected canonical", "Crawled – currently not indexed", or 404s.
- **Experience → Core Web Vitals:** needs real-user traffic before data appears.
- **Performance:** queries, impressions, clicks — use these to validate `docs/SEO-KEYWORDS.md`.

## What could not be verified from here

- Whether the property is already verified, current index coverage, crawl stats, manual actions, and real Core Web Vitals — all require your Search Console access.
- Live production headers and redirects: the automated environment used for this audit could not reach the production domain directly, so production checks after deployment must be done in a browser (see `docs/AUDIT-REPORT.md`, “Post-deployment checklist”).

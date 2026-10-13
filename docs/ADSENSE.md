# Google AdSense readiness

Approval is never guaranteed.

## Current status (13 October 2026)

- ✅ AdSense code for publisher `ca-pub-7768945509942907` is in the `<head>` of all 8 indexable pages (not the 404 page).
- ✅ `ads.txt` published at the site root: `google.com, pub-7768945509942907, DIRECT, f08c47fec0942fa0`.
- ✅ CSP extended for Google ad domains (`script-src`, `connect-src`, `frame-src`, `fenced-frame-src`, `img-src https:`, `style-src 'unsafe-inline'` for ad styling); COOP set to `same-origin-allow-popups`.
- ✅ Privacy Policy and homepage updated with the required AdSense cookie disclosures.
- ⏳ Site verification and review in AdSense — your action.
- ⏳ Consent message (Privacy & messaging → European regulations) — your action.
- ⏳ Ad units: the `.ad-slot` containers are still hidden. After approval, either place units in them (step 3 below) or use Auto ads — if you use Auto ads, check on mobile that no ad appears inside or right next to the converter.
- ⚠️ Vercel Hobby plan does not permit ads (see blocker 1).

The sections below were written before the code was added and remain the reference for the remaining steps.

## Blockers to resolve first (your action)

1. **Hosting plan.** The site is on Vercel. Vercel's [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) restrict **Hobby** (free) accounts to non-commercial use and explicitly list "the inclusion of advertisements, including … Google AdSense" as commercial usage. Before showing ads, either upgrade the project's team to **Vercel Pro** (see [vercel.com/pricing](https://vercel.com/pricing)) or move hosting to a provider whose free tier allows commercial use.
2. **Domain (recommended, not strictly required).** `vercel.app` is on the Public Suffix List, so `image-to-text-ocr-ten.vercel.app` is treated as its own site and an `ads.txt` at its root is valid. A custom domain is still recommended: it is easier to brand, survives a hosting move, and avoids depending on a shared platform domain. If you buy one, update the URLs listed in `docs/SEARCH-CONSOLE.md` first.
3. **Contact method.** The Contact page currently points to GitHub Issues. Adding a contact email address you control is recommended for review.
4. **Traffic and age.** Brand-new sites with little traffic are often asked to wait. Applying after the pages are indexed and receiving some organic visits is more likely to succeed (not guaranteed).

## Already in place

- Original, useful content on every page (tool, how-to, language guides, FAQ); no thin or duplicate pages.
- Clear navigation; About, Contact, Privacy Policy and Terms of Use pages that describe the real implementation.
- Mobile-friendly layout, no broken links, no pop-ups, no misleading claims.
- **Reserved ad positions** (`<aside class="ad-slot" … hidden>`): after the converter and between content sections on the homepage, and after the converter on each language page. They are hidden, take no space and make no requests until you enable them. None sit inside or next to the upload, extract, copy or download controls.

## Application checklist

1. Resolve the hosting-plan blocker above.
2. Make sure the site is indexed (see `docs/SEARCH-CONSOLE.md`).
3. Sign in at <https://adsense.google.com> → add the site `image-to-text-ocr-ten.vercel.app` (or your custom domain).
4. AdSense shows a verification snippet. Choose the **ads.txt** or **meta tag** method if offered; otherwise add the AdSense `<script>` to the `<head>` of `index.html` (see "Enabling ads" for the CSP change it needs).
5. In AdSense → **Privacy & messaging**, create a **European regulations (GDPR)** message so a Google-certified consent platform is shown to visitors in the EEA, UK and Switzerland. Google requires a certified CMP integrated with the IAB TCF to serve personalized ads to those visitors ([Google's requirements](https://support.google.com/admanager/answer/13554116)). Also review the **US state regulations** message.
6. Update the Privacy Policy (template below) **before** ads go live.
7. Request review and wait for the result (often days to weeks).

## After approval: enabling ads

Replace `pub-XXXXXXXXXXXXXXXX` with the publisher ID shown in your AdSense account. Do not guess it.

### 1. `ads.txt` (repository root)

```text
google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
```

Copy the exact line AdSense shows you under **Sites → ads.txt**.

### 2. Content-Security-Policy

The current CSP in `vercel.json` blocks all third-party scripts except `cdn.jsdelivr.net`, so ads will not load until it is extended. Deploy it as `Content-Security-Policy-Report-Only` first, watch the browser console for violations, then switch it to the enforced header. A typical starting point (check Google's current guidance, which changes over time):

- `script-src`: add `https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.adtrafficquality.google https://fundingchoicesmessages.google.com https://*.google.com`
- add `frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com`
- `img-src`: add `https:`
- `connect-src`: add `https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.adtrafficquality.google`
- Change `Cross-Origin-Opener-Policy` to `same-origin-allow-popups` so ad clicks can open new tabs normally.

### 3. Ad code

- Add to `<head>` of the pages that should show ads:
  `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>`
- In each `<aside class="ad-slot">` you want to use: remove the `hidden` attribute and put the `<ins class="adsbygoogle" …>` unit from AdSense inside `.ad-slot-inner`.
- The CSP does not allow inline scripts, so put `(adsbygoogle = window.adsbygoogle || []).push({});` (once per unit) in a new file such as `js/ads.js` and load it with `<script src="/js/ads.js" defer></script>`.
- Keep the "Advertisement" label. Never add text such as "click here" or place ads next to the converter buttons.

### 4. Privacy Policy update (required disclosures)

Replace the "Analytics and advertising" section of `privacy.html` with an accurate version, for example:

> This website shows ads served by Google AdSense. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this and other sites. You can opt out of personalized advertising in [Google Ads Settings](https://adssettings.google.com). Learn more in [How Google uses information from sites that use its services](https://policies.google.com/technologies/partner-sites). Visitors in the EEA, the UK and Switzerland are asked for consent through Google's consent message before personalized ads are shown.

Also remove "no cookies" and "no advertising" from the homepage "Private by design" section, the About page and this policy's summary. Images still stay on the device: ads do not change how OCR works.

### 5. Verify

Check the live site on mobile and desktop, confirm that ads do not shift or overlap the converter, check that the consent message appears for an EEA visitor (for example using a VPN), and run the regression tests in `docs/AUDIT-REPORT.md` again.

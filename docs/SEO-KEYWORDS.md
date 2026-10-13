# Keyword mapping (hypotheses)

> **Status: unvalidated hypotheses.** No search-volume or competition data has been collected yet. Treat every keyword below as a guess to be tested with Google Search Console (Performance → Queries) and a keyword tool (Google Keyword Planner, or Search Console data once the site has impressions). Metadata alone will not produce first-page rankings; content quality, links from other sites, and time all matter.

## Mapping

| Keyword group | Example queries (hypotheses) | Target URL | Where it is used on the page |
| --- | --- | --- | --- |
| **Primary** | image to text, image to text converter, convert image to text | `/` | `<title>`, H1 "Free Image to Text Converter", meta description, intro |
| Secondary OCR | free online OCR, OCR online, extract text from image, photo to text, picture to text | `/` | Title ("Free Online OCR"), description, "How to convert an image to text" |
| Format-specific | JPG to text, PNG to text, screenshot to text, WebP to text, TIFF to text | `/` | "Supported formats" section, FAQ |
| Use-case | copy text from screenshot, scanned document to text, extract text from photo | `/` | "What people use it for", "Tips for better results" |
| Privacy | OCR without upload, private OCR, offline-style browser OCR | `/` | "Private by design" section, FAQ (do **not** claim offline support) |
| Hindi | Hindi image to text, Hindi OCR, Devanagari OCR, हिंदी इमेज टू टेक्स्ट | `/hindi-image-to-text` | Title, H1, Devanagari tips, Unicode section |
| Gujarati | Gujarati image to text, Gujarati OCR, ગુજરાતી OCR | `/gujarati-image-to-text` | Title, H1, Gujarati tips, Unicode section |
| Urdu | Urdu image to text, Urdu OCR, اردو OCR, Nastaliq OCR | `/urdu-image-to-text` | Title, H1, Naskh/Nastaliq guidance, RTL section |
| Other languages | Marathi / Bengali / Tamil / Telugu / Arabic image to text | `/` (`#languages`) for now | Language list. Create a dedicated page **only** if Search Console shows real impressions and you can write genuinely useful language-specific guidance. |
| Brand | ImageToText OCR | all pages | Site name, Open Graph `og:site_name`, JSON-LD `WebSite` |

## Rules followed

- One primary topic per URL; language pages target only their own language, so they don't compete with the homepage.
- No keyword stuffing, no hidden text, no auto-generated pages.
- Language pages contain unique, language-specific help (script tips, Unicode/legacy-font notes, Nastaliq limitations) and the working tool with that language preselected.

## How to validate (next 30–60 days)

1. After indexing, open Search Console → **Performance → Search results** and filter by page.
2. Note queries with impressions but low click-through rate: improve the title/description for those pages (Google may still rewrite them).
3. Queries with impressions for another language (for example "Marathi OCR") are evidence that a new language page could be useful.
4. Re-check this table every month and replace guesses with real queries.

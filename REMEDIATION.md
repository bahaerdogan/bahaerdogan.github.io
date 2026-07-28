# Remediation — what changed, and what's left for you

Companion to `AUDIT-REPORT.md`. Scope was **Critical + High, mechanical only**: code, config and metadata. Your prose was not rewritten, apart from four factual corrections you approved.

Verify at any time with:

```bash
npm run verify     # build + re-run all 34 audit checks
npm run check      # checks only
```

Current state: **34/34 checks pass**, build is idempotent, `npm run build` twice produces byte-identical output.

---

## Two things the audit missed, found during the fix

**1. Two pages were rendering completely blank in production.**

`AlgorithmsExplainedDE.html` and `MachineLearning-ExplainedTR.html` had **no `<body>` element at all** — the document ended at `</head></html>`. Confirmed live before the fix.

`AlgorithmsExplainedDE.html` lost its body in commit `4cad2db` *"fix: Remove emailjs from DE HTML files"*. A regex intended to strip one script tag matched greedily from the EmailJS tag to the end of the file and deleted everything after it. It had been live and empty ever since, listed in the sitemap and the RSS feed the whole time.

Both were recovered from git history (`8629233` and `33f1402`), re-merged with their current heads, and the EmailJS remnants removed properly. They now carry 864 and 920 words respectively.

**2. Seven pages had `og:image` pointing at files that never existed** — `agenticai.png`, `post-4.png`, `post-5.png`, `image.png`. Social previews were broken entirely, not just wrong. `og:image` is now derived from the hero image each page actually renders.

---

## Fixed

### Critical

| | Was | Now |
|---|---|---|
| **C1 Contact form** | Called MailChannels' free Workers API — shut down June 2024 — with no key, awaited, so every visitor got HTTP 500 | Migrated to Resend. **Needs your API key — see below.** |
| **C2 Preloader** | Opaque full-screen overlay removed only on `window.load`; blank page if JS failed | Deleted from all 51 pages, CSS, and the build. `prefers-reduced-motion` support added site-wide |
| **C3 LaTeX** | 32 raw tokens rendering as literal backslashes; no math renderer anywhere | KaTeX loaded on the 2 pages with real math, deferred, SRI-pinned |
| **C4 Pinch-zoom** | `user-scalable=no` on 36 pages (WCAG 1.4.4 failure) | 0 pages |
| **C5 Schema** | All 50 articles: same fake `2024-03-20` date, same wrong image, empty description | Real dates from git history, per-page images, real descriptions |
| **C6 Placeholders** | 6 one-sentence German pages + 3 templates indexed, schema-marked, RSS-syndicated, linked from the language menu | `noindex`, out of sitemap/feed/llms.txt, switcher links removed |
| **C7 Duplicate scripts** | GA4 and `main.min.js` loaded twice on 20 pages — analytics inflated ~2×, handlers double-bound | 0 duplicates, guarded by a build assertion |

### High

- **Build no longer corrupts itself.** The root cause of C5: `html-minifier-terser` runs with `sortAttributes: true` and writes over its own input, so the attribute-order-dependent regexes that read `og:image` and `description` stopped matching after the first build and silently fell back to hardcoded defaults. Replaced with a real HTML parser (`node-html-parser`) in `tools/site-meta.js`.
- **LCP heroes no longer lazy-loaded** — the `data-no-lazy` escape hatch existed but was used zero times. Hero images now get `fetchpriority="high"`.
- **All 51 images have `width`/`height`** — was 0 of 51. This was the site's main layout-shift source.
- **Render-blocking CSS 320 KB → 212 KB.** Font Awesome removed entirely (9 glyphs replaced with inline SVG, −30 KB CSS and −500 KB of fonts); `animate.css`, Owl Carousel and Lightbox stylesheets dropped (their JS was already being stripped); unused jsDelivr preconnect removed.
- **Comment double-escaping fixed.** The Worker escaped on write *and* the client escaped on render, so `don't` displayed as `don&#x27;t` and every URL as `https:&#x2F;&#x2F;`. Escaping now happens once, at render. Attribute contexts use a proper attribute escaper.
- **Comment storage bounded** to 500 per post so a single KV value can't hit the 25 MB limit.
- **Commenter IPs and emails no longer stored.** They were kept in KV for a year with no privacy policy and no stated lawful basis.
- **Turnstile support wired in** (inactive until you set `TURNSTILE_SECRET`, so nothing breaks in the meantime).

### Also fixed

- `llms-full.txt` was a byte-identical copy of `llms.txt`. Now 192 KB of actual article text.
- `llms.txt` descriptions were all empty. Now populated.
- Sitemap `lastmod` was the build timestamp on every URL, so Google discards it. Now from git history.
- RSS re-published all 50 articles on every deploy. Now uses real first-commit dates, plus `atom:self`, `<language>`, `lastBuildDate`.
- hreflang grouping bug: `/TR\.html$/i` also matched `-tr.html`, so `ai-and-human-job-competition` never paired with its Turkish version. Fixed.
- OpenGraph was missing `og:title`, `og:description`, `og:type` and `og:url` on **every page**. `updateI18nHeadsAndToggle` stripped them and only re-added them for TR/DE. Social tags now have a single owner.
- Author entity is now inlined with `sameAs` on every article. It was a cross-page `@id` reference, which Google does not resolve.
- `<main>` landmark on all 51 pages (was 1). 25 skip links pointed at a `#main-content` that didn't exist.
- Exactly one `<h1>` per page (5 pages had two, 6 had none).
- `node_modules` untracked: **1,547 → 199 tracked files**.
- ~55 MB of unused multi-megabyte PNGs moved to `img/_originals/` (gitignored, still on your disk, also in git history). Deployed `img/` is now 5.4 MB.
- Filenames with spaces and parentheses renamed — they were breaking URL parsing.
- **CSP is now generated by the build** from the inline scripts actually present. It had 60 hand-maintained hashes that went stale on any edit; the correct number was 90. By externalising the per-page search data and dropping the redundant per-page GA config, it's down to 17, regenerated automatically.
- Minification failures now **fail the build**. They previously only warned, so the build carried on and deployed the *previous* `.min.js` — which is how stale code was reaching production.

### Content

Four factual errors in `AgenticAiTechDepth.html` (and the TR version):

- **ReWOO** was defined as "Read, Write, Observe, Operate" and attributed to Microsoft Research. It is **Reasoning WithOut Observation** (Xu et al., 2023). The invented expansion had also generated a wrong description of how it works, which is now rewritten and cited.
- **ReAct** — "Recommended by Google researchers" → Yao et al., Princeton + Google Brain, 2022, with a link.
- **"Azure Code Interpreter"** is not a product.
- The heuristics bullet ("Learned or stipulated encoded rules stored within the system with preference") parsed to nothing and was rewritten.

---

## What you need to do

### 1. Set the Resend key — the contact form stays broken until you do

```bash
# 1. Sign up at resend.com, verify bahaerdogan.com, create an API key
cd cloudflare-worker
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
curl https://comment-handler.baha-erdogann.workers.dev/health   # {"ok":true,"email":"configured"}
```

Deploy with `wrangler deploy`, not the dashboard — a comment in the old worker recorded that deploys were manual, which is how the committed source and the running Worker drift apart.

### 2. Commit

`node_modules` removal is already staged. Review and commit:

```bash
git status
git diff --stat
git commit -m "Fix production audit findings: contact form, render blocking, schema, accessibility"
```

The pre-fix state is tagged `pre-audit-fixes` if you need to compare or revert.

### 3. Confirm where security headers are actually served

The repo ships both `.htaccess` (Apache) and `_headers` (Cloudflare Pages / Netlify). On GitHub Pages **neither is read**, which would mean the CSP, HSTS and cache rules are all inert:

```bash
curl -sI https://bahaerdogan.com | grep -i "content-security-policy\|strict-transport\|cache-control"
```

Empty output confirms it. Either move to Cloudflare Pages (where `_headers` works as written) or add a Cloudflare Transform Rule — then delete whichever file is dead.

### 4. Existing comments will show escape artifacts

Comments already in KV were stored HTML-escaped. New ones are stored raw. Any existing comment containing punctuation will display entity codes until you re-save it. Given the comment counters all read 0, this is likely moot.

---

## Deliberately not done (first pass)

> Superseded — see "Second pass" below. All but two of these are now done.


- **Ionicons (50 KB CSS + 800 KB fonts for 18 glyphs).** Font Awesome was 9 well-known shapes I could author confidently; Ionicons is 18 and I'd be guessing at glyph paths I can't visually verify. Worth doing with the real SVGs to hand — it's the last easy 50 KB off the critical path.
- **`src/` → `dist/` split.** You chose to patch in place. The build is idempotent now, so the corruption class is closed, but source and output still live in the same files and the committed HTML is still minified and hard to diff.
- **Nav contrast.** `#48abec` is 2.53:1 on white and fails WCAG AA on the main navigation. Fixing it changes the site's visual identity, so it's your call — roughly `#0a5fc4` clears AA.
- **GA consent gate.** Analytics still fires without consent. Some pages carry a Consent Mode block and most don't. There's still no privacy policy, and you target German readers via hreflang.
- **All prose.** Everything in "Things That Still Feel AI Generated" stands. The Agentic AI series is still four overlapping articles with no first-hand experience, and it's still the weakest content on an engineering portfolio.

The single highest-value remaining item is unchanged from the audit: **one article about something you actually built at Huawei, with numbers, code, and one thing that went wrong.**

---

# Second pass — 28 July 2026

Closes everything the first pass left open except the two content items, and fixes
six defects found while doing it that neither the audit nor the first pass caught.

`npm run verify` — build + **53** checks (was 34). Build is idempotent: two
consecutive runs produce byte-identical output.

## Confirmed against production first

`curl -sI https://bahaerdogan.com` returns `server: cloudflare`,
`x-github-request-id`, `via: varnish` — and **not one security header**. H5 is
confirmed: the site is served by GitHub Pages, which reads neither `_headers`
(Cloudflare Pages / Netlify) nor `.htaccess` (Apache). The entire CSP, HSTS and
cache policy were inert.

## Not previously found

1. **The sidebar search was wired to the wrong function on 42 pages.** The form
   called `handleSearch()`, defined in `main.js` over a hardcoded two-entry list
   with a `// ... existing blog posts ...` placeholder. The real index —
   `searchBlog()` in the generated `blog-search.js`, with all 18 posts — was
   never called. Every query except two reported "No matching posts found."
2. **`scrollToTop()` did not exist.** `BlogPosts.html`'s floating action button
   called it via inline `onclick`; the function is defined nowhere in the repo,
   so the button threw a ReferenceError on every click.
3. **Four dead social links.** Facebook, Instagram, Pinterest and Twitter icons
   sat in `<a href="">`, and an empty href re-navigates to the current page.
   Removed rather than converted.
4. **`BlogPosts.html` had no `<footer>`** — nor did the pages generated from it.
5. **Three breadcrumbs pointed at `#`** ("Home", "Library") instead of real pages.
6. **`.back-to-top i`, `.reading-time i` and `.view-all-posts .btn i` were dead
   selectors** — the first pass replaced those `<i>` glyphs with `<svg>` but left
   the CSS targeting `i`, so the back-to-top icon lost its centring.

## Done

**Ionicons removed.** 18 glyphs to inline SVG, `lib/ionicons` deleted (51 KB CSS
+ 4 font files, 812 KB). Every glyph was rendered in a browser and visually
checked before finishing — that was the blocker last time. Render-blocking CSS is
now **165 KB** (Bootstrap 141 + own 25), down from ~320 KB.

**Contrast.** Introduced `--brand` / `--brand-ink`. `#48abec` stays for
backgrounds, borders and fills; text on light surfaces uses `#0a5fc4` (6.09:1,
clears AA with headroom). The one exception is the breadcrumb over the hero's
`rgba(0,0,0,.7)` overlay, where the light blue is correct and darkening it would
*reduce* contrast. `a { color: #0078ff }` (4.09:1) was also below AA and moved.

**GDPR.** Privacy policy in EN/TR/DE, linked from every footer, covering each
actual data flow with its lawful basis and retention. Consent Mode v2 now runs
**before** `gtag('config')` — it was in a `defer`red script, so a page_view fired
ungated on every first visit. Verified in-browser: no `_ga` cookie before
consent, cookies appear after Accept. `initGoogleAnalytics()` removed: it re-ran
`config` after consent, double-counting every consenting visitor on every page.
Commenter IPs are now hashed (truncated SHA-256) rather than used raw as KV keys.

**CSP actually enforced.** Emitted as `<meta http-equiv>` on all 54 pages, kept
byte-identical to `_headers` minus `frame-ancestors` (invalid in meta). This
required removing all inline event handlers first — including the KaTeX
`onload=`, which would otherwise have silently un-rendered the maths again, the
audit's single most damaging finding. Confirmed in-browser: 11 KaTeX nodes
render, zero raw LaTeX tokens, no CSP violations. `.htaccess` deleted.

**Navigation, brand, breadcrumbs.** Nav normalised to one item set per language
(was nine different sets; one German page had lost everything but "Blog").
"Bahaerdogan" → "Baha Erdoğan" everywhere. The invalid `youtube.com/c/bahaerdoğan`
`sameAs` removed — a YouTube handle cannot contain `ğ`. 335 dead `href="#"` tag
and category anchors became text. Breadcrumbs naming a different article fixed;
deliberately shortened ones left alone.

**Also.** `lastmod` now tracks the last commit that changed a page's *visible
text*, so a site-wide markup pass no longer re-dates all 42 URLs to one instant
(Google discards a uniform `lastmod`). Web app manifest added for the
already-declared `theme-color`. Dead `#preloader` CSS and JS removed. "Engineed"
→ "Engineered". Single-density `imagesrcset` dropped.

## Still open

- **`src/` → `dist/` split.** Still patched in place.
- **The prose.** Unchanged, and still the highest-value item: one article about
  something you actually built at Huawei, with numbers, code, and one thing that
  went wrong.

## Two things need you

1. **`RESEND_API_KEY`** — the contact form stays broken until it is set. See
   "What you need to do" above.
2. **Security headers still need a real host.** The `<meta>` CSP works, but
   HSTS, `X-Frame-Options` and `frame-ancestors` cannot be set from markup.
   Move to Cloudflare Pages (where `_headers` works as written) or add a
   Cloudflare Transform Rule.
3. **The YouTube URL is still wrong in visible text** (`youtube.com/bahaerdoğan`
   on the homepage). I removed it from the schema but did not guess a
   replacement — tell me the real handle and it is a one-line fix.

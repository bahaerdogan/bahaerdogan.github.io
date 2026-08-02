/**
 * Build gate. Every rule here corresponds to a defect that actually shipped to
 * production on this site at some point — fabricated dates, empty schema
 * descriptions, a shared header image on fifty unrelated articles, og:image
 * pointing at files that never existed, two pages with no <body> at all.
 *
 * Catching those at build time is the only durable fix; a checklist is not one.
 * `build()` calls this last and exits non-zero on any error, so a broken article
 * cannot be deployed silently.
 */

const fs = require('fs');
const glob = require('glob');
const { parse } = require('node-html-parser');
const { NOT_ARTICLES, readMeta, langOf } = require('./site-meta.js');

function validateArticles() {
  const errors = [];
  const warnings = [];
  const slugs = new Map();
  const pages = glob.sync('*.html');
  const existing = new Set(pages);

  for (const file of pages) {
    const html = fs.readFileSync(file, 'utf8');
    const root = parse(html);
    const meta = readMeta(file, html);
    const isArticle = !NOT_ARTICLES.has(file) && !meta.noindex;
    const err = (msg) => errors.push(`${file}: ${msg}`);

    // --- Applies to every page, article or not ---
    if (!/<body/i.test(html)) err('no <body> element');
    if (!root.querySelector('main')) err('no <main> landmark');
    if ((html.match(/<h1\b/gi) || []).length !== 1) err(`expected exactly one <h1>, found ${(html.match(/<h1\b/gi) || []).length}`);
    if (!root.querySelector('link[rel="canonical"]')) err('missing canonical');

    // Images must be described and must reserve their box.
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      if (img.getAttribute('alt') == null) err(`<img src="${src}"> has no alt attribute`);
      if (!img.getAttribute('width') || !img.getAttribute('height')) err(`<img src="${src}"> has no intrinsic dimensions`);
    }

    // Internal links must resolve. A 404 from your own nav is worse than a
    // missing page, because it looks maintained.
    for (const a of root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      if (!href || /^(https?:|mailto:|tel:|#|data:)/i.test(href)) continue;
      const target = href.split('#')[0].split('?')[0];
      if (!target) continue;
      if (!existing.has(target) && !fs.existsSync(target)) err(`broken internal link → ${target}`);
    }

    if (!isArticle) continue;

    // --- Article-only requirements ---
    if (!meta.title) err('missing title');
    if (!meta.description) err('missing meta description');
    if (!meta.category) err('missing category (add it to CATEGORY_OF_GROUP in tools/site-meta.js)');
    if (!meta.image) err('missing featured image');
    if (!meta.datePublished || !/^\d{4}-\d{2}-\d{2}$/.test(meta.datePublished)) err(`invalid datePublished "${meta.datePublished}"`);
    if (!meta.excerpt) err('could not derive an excerpt');
    if (!meta.words) err('no readable body text');

    const og = (sel) => {
      const el = root.querySelector(sel);
      return el ? (el.getAttribute('content') || '').trim() : '';
    };
    if (!og('meta[property="og:image"]')) err('missing og:image');
    if (!og('meta[property="og:title"]')) err('missing og:title');
    if (!og('meta[property="og:description"]')) err('missing og:description');

    // og:image must point at a file that exists. Seven pages once referenced
    // images that had never been committed, so every social preview was blank.
    const ogImg = og('meta[property="og:image"]').replace(/^https?:\/\/[^/]+\//, '');
    if (ogImg && !/^https?:/i.test(ogImg) && !fs.existsSync(ogImg)) err(`og:image does not exist → ${ogImg}`);

    // Structured data has to be present, parseable, and actually describe this
    // page — the fabricated-date defect passed a "has JSON-LD" check for months.
    const ld = root.querySelectorAll('script[type="application/ld+json"]');
    if (!ld.length) err('missing JSON-LD structured data');
    for (const node of ld) {
      try {
        const json = JSON.parse(node.text);
        const graph = json['@graph'] || [json];
        const article = graph.find((n) => /Article|BlogPosting/i.test(n['@type'] || ''));
        if (article) {
          if (!article.headline) err('JSON-LD article has no headline');
          if (!article.description) err('JSON-LD article has an empty description');
          if (!article.image) err('JSON-LD article has no image');
          if (!article.datePublished) err('JSON-LD article has no datePublished');
        }
      } catch (e) {
        err(`JSON-LD is not valid JSON (${e.message})`);
      }
    }

    // Duplicate slugs would make two articles fight over one canonical URL.
    const slug = file.replace(/\.html$/i, '').toLowerCase();
    if (slugs.has(slug)) err(`duplicate slug, also used by ${slugs.get(slug)}`);
    else slugs.set(slug, file);

    if (!meta.tags.length) warnings.push(`${file}: no tags — related-article ranking falls back to category alone`);
  }

  if (warnings.length) {
    console.warn(`  ${warnings.length} warning(s):`);
    warnings.forEach((w) => console.warn(`    ⚠ ${w}`));
  }

  if (errors.length) {
    console.error(`\n  ✗ ${errors.length} validation error(s):`);
    errors.forEach((e) => console.error(`    ${e}`));
    throw new Error(`Article validation failed with ${errors.length} error(s)`);
  }

  const articleCount = pages.filter((f) => !NOT_ARTICLES.has(f)).length;
  console.log(`  ✓ validated ${pages.length} pages (${articleCount} articles), 0 errors`);
}

module.exports = { validateArticles };

/**
 * Blog surface renderer — the single place article cards are built.
 *
 * Everything here runs at build time and emits static HTML. That is deliberate:
 * the pasted React/framer-motion reference renders cards on the client, which on
 * this site would mean an empty grid until JS parses (bad LCP), layout shift as
 * cards land (bad CLS), and no article links for crawlers (bad SEO). The same
 * design — staggered reveal, hover lift, category badge, modal-free navigation —
 * is achievable with static markup plus CSS, so that is what this does. The only
 * JavaScript is progressive enhancement over already-present DOM.
 *
 * Counts are never written by hand. Every number on the blog index is derived
 * from this list, so publishing an article updates the statistics, the filter
 * bar and both grids at once.
 */

const fs = require('fs');
const glob = require('glob');
const { NOT_ARTICLES, CATEGORIES, categoryLabel, readMeta, groupKeyOf } = require('./site-meta.js');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Intrinsic dimensions for every post image, so each card reserves its box
 * before the image arrives. Cards are a fixed 16:9 crop via aspect-ratio, but
 * the attributes still have to be right: a wrong ratio in width/height is worse
 * than none, because the browser reserves the wrong box and shifts twice.
 */
async function probeDims(posts) {
  const sharp = require('sharp');
  const out = {};
  await Promise.all(posts.map(async (p) => {
    const rel = String(p.image).replace(/^https?:\/\/[^/]+\//, '').replace(/^\.?\//, '');
    try {
      const { width, height } = await sharp(rel).metadata();
      if (width && height) out[p.file] = { width, height };
    } catch {
      // Image missing locally. 16:9 matches the CSS crop, so the box is still
      // reserved at the right size and nothing shifts.
      out[p.file] = { width: 1600, height: 900 };
    }
  }));
  return out;
}

const DATE_LOCALE = { en: 'en-GB', tr: 'tr-TR', de: 'de-DE' };
const fmtDate = (iso, lang) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(DATE_LOCALE[lang] || 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
};

const T = {
  en: { read: 'Read article', min: 'min read', featured: 'Featured', all: 'All', more: 'Load more articles', latest: 'Latest articles', none: 'No articles match that filter.', search: 'Search articles', total: 'Total Posts' },
  tr: { read: 'Yazıyı oku', min: 'dk okuma', featured: 'Öne çıkan', all: 'Tümü', more: 'Daha fazla yazı', latest: 'Son yazılar', none: 'Bu filtreye uyan yazı yok.', search: 'Yazılarda ara', total: 'Toplam Yazı' },
  de: { read: 'Artikel lesen', min: 'Min. Lesezeit', featured: 'Empfohlen', all: 'Alle', more: 'Mehr Artikel laden', latest: 'Neueste Artikel', none: 'Keine Artikel entsprechen diesem Filter.', search: 'Artikel suchen', total: 'Beiträge' },
};
const t = (lang, k) => (T[lang] || T.en)[k];

/** Indexable articles for one language, newest first. */
function collectPosts(lang) {
  return glob.sync('*.html')
    .filter((f) => !NOT_ARTICLES.has(f))
    .map((f) => readMeta(f, fs.readFileSync(f, 'utf8')))
    .filter((m) => !m.noindex && m.lang === lang && m.category)
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : a.datePublished > b.datePublished ? -1 : a.title.localeCompare(b.title)));
}

/** Counts per category, plus the total. Derived, never written by hand. */
function statsFor(posts) {
  const by = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  posts.forEach((p) => { if (by[p.category] != null) by[p.category]++; });
  return { total: posts.length, ...by };
}

/**
 * Card headline. `readMeta` keeps the full <title> because sitemap and schema
 * want it, but "Anomaly Detection in Machine Learning | Technical Guide &
 * Examples" is a search-results title, not a card headline. Everything from the
 * first pipe is a keyword tail, so it is dropped for display only.
 */
function displayTitle(post) {
  const cut = post.title.split('|')[0].trim();
  return cut.length >= 12 ? cut : post.title.trim();
}

function excerptOf(post, max = 150) {
  const d = (post.description || '').replace(/\s+/g, ' ').trim();
  if (d.length <= max) return d;
  return d.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

/**
 * One article card. The whole card is a single <a>, so the click target matches
 * the visual target and keyboard users get exactly one stop per article rather
 * than three competing ones (image, title, CTA).
 */
function renderCard(post, lang, { dims, eager = false } = {}) {
  const d = dims[post.file] || { width: 1600, height: 900 };
  const src = String(post.image).replace(/^https?:\/\/[^/]+\//, '');
  const loading = eager ? '' : ' loading="lazy"';
  const priority = eager ? ' fetchpriority="high"' : '';
  return `<article class="post-card">` +
    `<a class="post-card__link" href="${esc(post.file)}">` +
      `<span class="post-card__media">` +
        `<img class="post-card__img" src="${esc(src)}" alt="${esc(post.title)}" width="${d.width}" height="${d.height}"${loading}${priority} decoding="async">` +
      `</span>` +
      `<span class="post-card__body">` +
        `<span class="post-card__badge" data-cat="${esc(post.category)}">${esc(categoryLabel(post.category, lang))}</span>` +
        `<h3 class="post-card__title">${esc(displayTitle(post))}</h3>` +
        `<span class="post-card__excerpt">${esc(excerptOf(post))}</span>` +
        `<span class="post-card__meta">` +
          `<time datetime="${esc(post.datePublished)}">${esc(fmtDate(post.datePublished, lang))}</time>` +
          `<span class="post-card__dot" aria-hidden="true">·</span>` +
          `<span>${post.readingTime} ${esc(t(lang, 'min'))}</span>` +
        `</span>` +
        `<span class="post-card__cta">${esc(t(lang, 'read'))}` +
          `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M12 5l7 7-7 7"/></svg>` +
        `</span>` +
      `</span>` +
    `</a>` +
  `</article>`;
}

/** The newest N articles, for the home page. */
function renderHomeGrid(posts, lang, dims, limit = 6) {
  return `<div class="post-grid">` +
    posts.slice(0, limit).map((p, i) => renderCard(p, lang, { dims, eager: i === 0 })).join('') +
  `</div>`;
}

/** Large hero treatment for the newest article on the blog index. */
function renderFeatured(post, lang, dims) {
  const d = dims[post.file] || { width: 1600, height: 900 };
  const src = String(post.image).replace(/^https?:\/\/[^/]+\//, '');
  return `<article class="post-featured">` +
    `<a class="post-featured__link" href="${esc(post.file)}">` +
      `<span class="post-featured__media">` +
        `<img class="post-featured__img" src="${esc(src)}" alt="${esc(post.title)}" width="${d.width}" height="${d.height}" fetchpriority="high" decoding="async">` +
      `</span>` +
      `<span class="post-featured__body">` +
        `<span class="post-featured__badges">` +
          `<span class="post-card__badge post-card__badge--solid">${esc(t(lang, 'featured'))}</span>` +
          `<span class="post-card__badge" data-cat="${esc(post.category)}">${esc(categoryLabel(post.category, lang))}</span>` +
        `</span>` +
        `<h2 class="post-featured__title">${esc(displayTitle(post))}</h2>` +
        `<span class="post-featured__excerpt">${esc(excerptOf(post, 220))}</span>` +
        `<span class="post-card__meta">` +
          `<time datetime="${esc(post.datePublished)}">${esc(fmtDate(post.datePublished, lang))}</time>` +
          `<span class="post-card__dot" aria-hidden="true">·</span>` +
          `<span>${post.readingTime} ${esc(t(lang, 'min'))}</span>` +
        `</span>` +
        `<span class="post-card__cta post-card__cta--lg">${esc(t(lang, 'read'))}` +
          `<svg class="icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M12 5l7 7-7 7"/></svg>` +
        `</span>` +
      `</span>` +
    `</a>` +
  `</article>`;
}

/** Category filter buttons, labelled with live counts. */
function renderFilters(posts, lang) {
  const s = statsFor(posts);
  const btn = (cat, label, count, active) =>
    `<button type="button" class="blog-filter__btn${active ? ' is-active' : ''}" data-filter="${esc(cat)}" aria-pressed="${active}">` +
      `${esc(label)}<span class="blog-filter__count">${count}</span>` +
    `</button>`;
  const present = CATEGORIES.filter((c) => s[c] > 0);
  return `<div class="blog-filter" role="group" aria-label="${esc(t(lang, 'latest'))}">` +
    btn('all', t(lang, 'all'), s.total, true) +
    present.map((c) => btn(c, categoryLabel(c, lang), s[c], false)).join('') +
  `</div>`;
}

module.exports = { collectPosts, statsFor, probeDims, displayTitle, renderCard, renderHomeGrid, renderFeatured, renderFilters, excerptOf, fmtDate, t, esc };

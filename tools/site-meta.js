/**
 * Shared metadata helpers for the build.
 *
 * These exist because the previous implementation read page metadata with
 * regexes that assumed a fixed attribute order. `html-minifier-terser` runs
 * with `sortAttributes: true` and writes back over the same files, so after the
 * first build every tag was reordered and every one of those regexes silently
 * stopped matching. The result was 50 pages sharing one hardcoded image, an
 * empty description, and a fabricated publication date.
 *
 * Everything here parses real HTML and derives real values.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parse } = require('node-html-parser');

const BASE_URL = 'https://bahaerdogan.com';

/** Pages that must never be indexed or syndicated. */
const EXCLUDED = new Set([
  'BlogTemplate.html',
  'BlogTemplateTR.html',
  'BlogTemplateDE.html',
  // German translations that are still placeholders.
  'DistanceCalculatingMethodsDE.html',
  'MachineLearning-ExplainedDE.html',
  'MachineLearningAnomalyDetectionDE.html',
  'AgenticAiTechDepthDE.html',
  'TypesOfAgenticAiDE.html',
  'ValuePerKilogramForProsperityDE.html',
]);

const NOT_ARTICLES = new Set([
  'index.html',
  'BlogPosts.html',
  // The privacy policy is a legal notice, not a blog post — it must not carry
  // BlogPosting schema, an author byline or a reading time.
  'privacy.html',
  'privacy-tr.html',
  'privacy-de.html',
]);

/** The canonical author entity, inlined into every article so Google can resolve it. */
const PERSON = {
  '@type': 'Person',
  '@id': `${BASE_URL}/#person`,
  name: 'Baha Erdoğan',
  givenName: 'Baha',
  familyName: 'Erdoğan',
  url: BASE_URL,
  jobTitle: 'Computer Engineer & AI R&D Specialist',
  worksFor: { '@type': 'Organization', name: 'Huawei R&D', url: 'https://www.huawei.com' },
  sameAs: [
    'https://www.linkedin.com/in/bahaerdogan/',
    'https://github.com/bahaerdogan',
  ],
  knowsAbout: [
    'Artificial Intelligence', 'Computer Vision', 'Machine Learning',
    'C++', 'Python', 'Deep Learning', 'Software Architecture',
  ],
};

/**
 * Article taxonomy, keyed by translation group so the Turkish and German
 * variants inherit their English original's category automatically.
 *
 * This is the site's frontmatter. There is no CMS and no markdown layer, so the
 * category has to be declared somewhere; declaring it once per *group* is what
 * keeps `MachineLearning-Explained`, `…TR` and `…DE` from drifting apart.
 *
 * Nothing downstream counts articles by hand — the statistics, the filter bar
 * and the category badges are all derived from this plus the file listing, so
 * adding an article updates every number on the site.
 *
 * The pages previously carried a free-text category in their visible post-meta,
 * which had drifted into seven overlapping labels: "AI" and "Artificial
 * intelligence" both existed, `AlgorithmsExplained` (a recommender-systems
 * explainer) was filed under "Economy", and every Agentic AI piece was "Technology".
 */
const CATEGORIES = ['AI', 'Technology', 'History', 'Finance'];

const CATEGORY_OF_GROUP = {
  // AI
  'agenticaiexplained': 'AI',
  'agenticaitechdepth': 'AI',
  'agenticaivsgenai': 'AI',
  'typesofagenticai': 'AI',
  'machinelearning-explained': 'AI',
  'machinelearninganomalydetection': 'AI',
  'whataimeanstoyou': 'AI',
  'ai-and-human-job-competition': 'AI',
  'ai-defense': 'AI',
  // Technology
  'distancecalculatingmethods': 'Technology',
  'algorithmsexplained': 'Technology',
  'macshortcuts': 'Technology',
  'preciousmetaldata': 'Technology',
  // History
  'whytolearnhistory': 'History',
  'oguzkaganepic': 'History',
  'ergenekonepic': 'History',
  // Finance
  'valueperkilogramforprosperity': 'Finance',
  'deservingmoney': 'Finance',
};

/** Localised badge/filter labels. The stored category stays language-neutral. */
const CATEGORY_LABELS = {
  AI: { en: 'AI', tr: 'Yapay Zekâ', de: 'KI' },
  Technology: { en: 'Technology', tr: 'Teknoloji', de: 'Technologie' },
  History: { en: 'History', tr: 'Tarih', de: 'Geschichte' },
  Finance: { en: 'Finance', tr: 'Ekonomi', de: 'Wirtschaft' },
};

const categoryLabel = (cat, lang) => (CATEGORY_LABELS[cat] || {})[lang] || cat;

/** Words per minute for the reading-time estimate. */
const WPM = 200;

/** Language of a page, from its filename convention. */
function langOf(file) {
  if (/TR\.html$/i.test(file) || /-tr\.html$/i.test(file)) return 'tr';
  if (/DE\.html$/i.test(file) || /-de\.html$/i.test(file)) return 'de';
  return 'en';
}

/**
 * Translation-group key. The old version used /TR\.html$/i, which also matched
 * `-tr.html`, so `ai-and-human-job-competition-tr.html` produced the key
 * "ai-and-human-job-competition-" and never paired with its English original.
 */
function groupKeyOf(file) {
  return file
    .replace(/-(tr|de)\.html$/i, '')
    .replace(/(TR|DE)\.html$/i, '')
    .replace(/\.html$/i, '')
    .toLowerCase();
}

/**
 * Date of the HEAD commit — the fallback for files git does not know about yet.
 *
 * mtime cannot be used: the build rewrites every page it touches, so an
 * untracked page would carry a new lastmod on every single build and put a
 * fresh timestamp into sitemap.xml each time. That is the exact "lastmod is the
 * build timestamp" defect the audit raised, reintroduced through the back door.
 */
let headDateCache = null;
function headDate() {
  if (headDateCache) return headDateCache;
  try {
    headDateCache = execFileSync('git', ['log', '--format=%aI', '-1'], { encoding: 'utf8' }).trim();
  } catch (_) { /* not a git repo */ }
  if (!headDateCache) headDateCache = new Date().toISOString();
  return headDateCache;
}

/** Real last-modified date from git; HEAD's date for files not yet committed. */
const dateCache = new Map();
function gitDate(file, which = 'modified') {
  const key = `${file}:${which}`;
  if (dateCache.has(key)) return dateCache.get(key);
  let iso = null;
  try {
    const args = which === 'published'
      ? ['log', '--diff-filter=A', '--follow', '--format=%aI', '-1', '--', file]
      : ['log', '--format=%aI', '-1', '--', file];
    const out = execFileSync('git', args, { encoding: 'utf8' }).trim();
    if (out) iso = out.split('\n').pop().trim();
  } catch (_) { /* not a git repo, or file untracked */ }
  if (!iso) iso = headDate();
  dateCache.set(key, iso);
  return iso;
}

/**
 * Date of the last commit that changed a page's *visible text*.
 *
 * `gitDate(file, 'modified')` returns the last commit to touch the file at all,
 * which is wrong for `lastmod`: a site-wide mechanical pass (adding <main>,
 * fixing the viewport meta, swapping icon fonts) rewrites all 51 files in one
 * commit and re-dates every article to the same instant. Google discards
 * `lastmod` when it isn't consistently accurate, so a uniform value throws away
 * the signal for the whole sitemap.
 *
 * This walks the file's history newest-first and returns the date of the newest
 * commit whose rendered text differs from the version before it. Markup-only
 * commits are skipped, so lastmod tracks what a reader would actually notice.
 */
const contentDateCache = new Map();
function contentDate(file) {
  if (contentDateCache.has(file)) return contentDateCache.get(file);

  // Build-generated furniture is excluded. The table of contents, share row,
  // previous/next links and related-article cards are all derived from other
  // pages, so publishing any article would otherwise count as a content change
  // on every article that links to it — re-dating the whole sitemap at once,
  // which is the "uniform lastmod" defect Google discards the feed for.
  // Only the author's own prose should move a page's dateModified.
  const GENERATED = [
    'script', 'style', 'noscript',
    '.widget-toc', '.post-share', '.post-nav', '.post-related',
    '.post-grid', '.blog-toolbar', '.stats-container',
  ].join(', ');

  const visibleText = (html) => {
    try {
      const root = parse(html);
      root.querySelectorAll(GENERATED).forEach((n) => n.remove());
      return root.structuredText.replace(/\s+/g, ' ').trim();
    } catch (_) {
      return html;
    }
  };

  let result = null;
  try {
    const log = execFileSync('git', ['log', '--format=%H %aI', '--', file], { encoding: 'utf8' }).trim();
    const commits = log ? log.split('\n').map((l) => {
      const i = l.indexOf(' ');
      return { sha: l.slice(0, i), date: l.slice(i + 1) };
    }) : [];

    const textAt = (sha) => {
      try {
        return visibleText(execFileSync('git', ['show', `${sha}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 26 }));
      } catch (_) {
        return null; // file did not exist at that commit
      }
    };

    for (let i = 0; i < commits.length; i++) {
      const now = textAt(commits[i].sha);
      if (now === null) break;
      const prev = i + 1 < commits.length ? textAt(commits[i + 1].sha) : null;
      // Newest commit whose text differs from its predecessor — or the commit
      // that introduced the file, when there is no predecessor.
      if (prev === null || prev !== now) {
        result = commits[i].date;
        break;
      }
    }
  } catch (_) { /* not a git repo */ }

  const iso = result || gitDate(file, 'modified');
  contentDateCache.set(file, iso);
  return iso;
}

const dateOnly = (iso) => String(iso).slice(0, 10);

/** Read the metadata a page actually declares, without assuming attribute order. */
function readMeta(file, html) {
  const root = parse(html);

  const titleEl = root.querySelector('title');
  const rawTitle = titleEl ? titleEl.text.trim() : '';
  const title = rawTitle
    .replace(/\s*\|\s*(Bahaerdogan|Baha Erdoğan|Deutsch|Türkçe|Opinion|AI Technology Guide|Computer Vision Guide|Data Science Guide|AI Development Guide|Historical Perspective Guide|AI Security Guide|AI Ethics Guide)/gi, '')
    .trim() || path.basename(file, '.html');

  const metaContent = (sel) => {
    const el = root.querySelector(sel);
    return el ? (el.getAttribute('content') || '').trim() : '';
  };

  let description = metaContent('meta[name="description"]');

  // Fall back to the article's own first paragraph rather than shipping "".
  if (!description) {
    const p = root.querySelectorAll('main p, .article-content p, .post-box p')
      .map((n) => n.text.replace(/\s+/g, ' ').trim())
      .find((t) => t.length > 80);
    if (p) description = p.slice(0, 155).replace(/\s+\S*$/, '') + '…';
  }

  // The image the page actually renders, not a global default.
  let image = '';
  const hero = root.querySelector('img[data-no-lazy]') || root.querySelector('main img') || root.querySelector('img');
  if (hero) image = hero.getAttribute('src') || '';
  if (!image) {
    const bg = html.match(/background-image:\s*url\(['"]?(img\/[^'")]+)['"]?\)/i);
    if (bg) image = bg[1];
  }
  if (image && !/^https?:/i.test(image)) image = `${BASE_URL}/${image.replace(/^\.?\//, '')}`;
  if (!image || /overlay-bg|testimonial/.test(image)) image = metaContent('meta[property="og:image"]') || `${BASE_URL}/img/AgenticAi1.webp`;

  const noindex = /noindex/i.test(metaContent('meta[name="robots"]')) || EXCLUDED.has(file);

  // Readable body text, used for llms-full.txt. Sidebars, the comment widget and
  // the breadcrumb are boilerplate repeated on all 50 pages — including them
  // would make the file mostly duplicate navigation instead of article text.
  // Tags, from the sidebar widget the pages already carry. Read *before* the
  // boilerplate strip below, which removes `.col-md-4` — and with it
  // `.widget-tags` — so that llms-full.txt gets article prose rather than
  // navigation. Extracting afterwards silently yielded zero tags on all 49
  // articles. Deduplicated case-insensitively so "AI" and "ai" are one tag.
  const tags = [...new Map(
    root.querySelectorAll('.widget-tags .tag')
      .map((n) => n.text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((t) => [t.toLowerCase(), t])
  ).values()];

  const main = root.querySelector('main') || root.querySelector('body') || root;
  main.querySelectorAll([
    'script', 'style', 'nav', 'footer', 'aside',
    '.widget-sidebar', '.sidebar-content', '.list-sidebar',
    '.comment-form', '.comments-section', '#comments',
    '.breadcrumb', '.blog-sidebar', '.col-md-4',
    // Build-generated furniture. These carry other articles' titles and
    // excerpts, so counting them inflates both the reading-time estimate and
    // the llms-full.txt body with navigation text that is not this article.
    '.post-share', '.post-nav', '.post-related', '.widget-toc',
  ].join(', ')).forEach((n) => n.remove());

  // Insert real separators: node-html-parser concatenates text nodes with no
  // whitespace, which would run headings into the following sentence.
  const BOILERPLATE = /^(Blog Details|Leave a Reply|Comments|Recent Post|Archives|Tags|Search|Name \*|Email \*|Comment \*|Submit Comment|Home|Blog|0)$/i;

  const text = main.structuredText
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !BOILERPLATE.test(l))
    .join('\n')
    .trim();

  const lang = langOf(file);
  const category = CATEGORY_OF_GROUP[groupKeyOf(file)] || '';
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  // Excerpt: 140–180 characters, cut on a sentence boundary rather than
  // mid-clause. The meta description is preferred when it already fits, since
  // it was written for the purpose; otherwise the first substantial paragraph
  // is used. Falling back to a hard character slice would strand half a
  // sentence followed by an ellipsis, which reads as broken rather than brief.
  const sentenceExcerpt = (source) => {
    const s = (source || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    if (s.length <= 180) return s;
    let out = '';
    for (const part of s.split(/(?<=[.!?…])\s+/)) {
      if (!out) { out = part; if (out.length >= 140) break; continue; }
      if ((out + ' ' + part).length > 180) break;
      out += ' ' + part;
      if (out.length >= 140) break;
    }
    // A single sentence longer than the window: trim to the last whole word.
    if (out.length > 180) out = out.slice(0, 180).replace(/\s+\S*$/, '') + '…';
    return out;
  };

  const firstPara = root.querySelectorAll('.post-box p, main p')
    .map((n) => n.text.replace(/\s+/g, ' ').trim())
    .find((t) => t.length > 80 && !/^(Home|Blog|Share|Comments)\b/i.test(t)) || '';

  const excerpt = sentenceExcerpt(description && description.length >= 140 ? description : (firstPara || description));

  return {
    file,
    url: file === 'index.html' ? `${BASE_URL}/` : `${BASE_URL}/${file}`,
    title,
    rawTitle,
    description,
    image,
    noindex,
    lang,
    category,
    categoryLabel: category ? categoryLabel(category, lang) : '',
    tags,
    excerpt,
    words,
    // Rounded up so a 292-word post reads "2 min" rather than "1 min", which
    // consistently under-promises on these articles.
    readingTime: Math.max(1, Math.ceil(words / WPM)),
    text,
    datePublished: dateOnly(gitDate(file, 'published')),
    // Both track real content change, so a markup-only build pass does not
    // re-date every article to the same instant.
    dateModified: dateOnly(contentDate(file)),
    lastmod: contentDate(file),
  };
}

module.exports = {
  BASE_URL, EXCLUDED, NOT_ARTICLES, PERSON,
  CATEGORIES, CATEGORY_OF_GROUP, CATEGORY_LABELS, categoryLabel, WPM,
  langOf, groupKeyOf, gitDate, contentDate, dateOnly, readMeta,
};

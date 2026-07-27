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

const NOT_ARTICLES = new Set(['index.html', 'BlogPosts.html']);

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

/** Real last-modified date from git, falling back to mtime for untracked files. */
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
  if (!iso) {
    try { iso = new Date(fs.statSync(file).mtime).toISOString(); } catch (_) { iso = new Date().toISOString(); }
  }
  dateCache.set(key, iso);
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
  const main = root.querySelector('main') || root.querySelector('body') || root;
  main.querySelectorAll([
    'script', 'style', 'nav', 'footer', 'aside',
    '.widget-sidebar', '.sidebar-content', '.list-sidebar',
    '.comment-form', '.comments-section', '#comments',
    '.breadcrumb', '.blog-sidebar', '.col-md-4',
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

  return {
    file,
    url: file === 'index.html' ? `${BASE_URL}/` : `${BASE_URL}/${file}`,
    title,
    rawTitle,
    description,
    image,
    noindex,
    lang: langOf(file),
    text,
    datePublished: dateOnly(gitDate(file, 'published')),
    dateModified: dateOnly(gitDate(file, 'modified')),
    lastmod: gitDate(file, 'modified'),
  };
}

module.exports = { BASE_URL, EXCLUDED, NOT_ARTICLES, PERSON, langOf, groupKeyOf, gitDate, dateOnly, readMeta };

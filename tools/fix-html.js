#!/usr/bin/env node
/**
 * One-shot remediation pass over the published HTML.
 *
 * Every transform here is idempotent: running this twice produces the same
 * output as running it once. That property is deliberate — the previous build
 * pipeline was not idempotent, which is how the schema metadata got corrupted.
 *
 * Usage: node tools/fix-html.js [--dry]
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve(__dirname, '..');

// Pages whose German translation is a placeholder, not an article.
const DE_STUBS = [
  'DistanceCalculatingMethodsDE.html',
  'MachineLearning-ExplainedDE.html',
  'MachineLearningAnomalyDetectionDE.html',
  'AgenticAiTechDepthDE.html',
  'TypesOfAgenticAiDE.html',
  'ValuePerKilogramForProsperityDE.html',
];

// Scaffold pages that should never have been indexable.
const TEMPLATES = ['BlogTemplate.html', 'BlogTemplateTR.html', 'BlogTemplateDE.html'];

const NOINDEX = [...DE_STUBS, ...TEMPLATES];

// Pages containing real LaTeX that needs a math renderer.
const MATH_PAGES = ['DistanceCalculatingMethods.html', 'AgenticAivsGenAi.html'];

const KATEX_VERSION = '0.16.11';
const KATEX_CSS = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css" integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+" crossorigin="anonymous">`;
const KATEX_JS = `<script defer src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js" integrity="sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg" crossorigin="anonymous"></script><script defer src="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/contrib/auto-render.min.js" integrity="sha384-43gviWU0YVjaDtb/GhzOouOXtZMP/7XUzwPTstBeZFe/+rCMvRwr4yROQP43s0Xk" crossorigin="anonymous" onload="renderMathInElement(document.body,{delimiters:[{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false}],throwOnError:false});"></script>`;

// Stylesheets whose matching JS the build already strips, or which are unused.
const DEAD_CSS = [
  'lib/animate/animate.min.css',
  'lib/owlcarousel/assets/owl.carousel.min.css',
  'lib/lightbox/css/lightbox.min.css',
];

const stats = {};
const bump = (k, f) => {
  (stats[k] = stats[k] || new Set()).add(f);
};

/** Cache of intrinsic image dimensions, keyed by src path. */
const dimCache = JSON.parse(
  fs.existsSync(path.join(ROOT, 'tools/.image-dims.json'))
    ? fs.readFileSync(path.join(ROOT, 'tools/.image-dims.json'), 'utf8')
    : '{}'
);

function fixViewport(html, file) {
  const re = /(<meta[^>]*name=["']viewport["'][^>]*>)/gi;
  return html.replace(re, (tag) => {
    if (!/maximum-scale|user-scalable/i.test(tag)) return tag;
    bump('viewport', file);
    return tag
      .replace(/,?\s*maximum-scale=[^,"']*/gi, '')
      .replace(/,?\s*user-scalable=(no|0)/gi, '');
  });
}

function dedupeScripts(html, file) {
  const seen = new Set();
  let removed = 0;
  html = html.replace(/<script\b[^>]*\bsrc=("|')(.*?)\1[^>]*><\/script>/gi, (tag, q, src) => {
    const key = src.split('?')[0];
    // Only dedupe our own bundles and the analytics loader.
    if (!/^(js|lib)\//.test(key) && !/googletagmanager\.com\/gtag/.test(key)) return tag;
    if (seen.has(key)) {
      removed++;
      return '';
    }
    seen.add(key);
    return tag;
  });
  // The inline gtag bootstrap is duplicated alongside the loader.
  const inlineGtag = /<script>function gtag\(\)\{dataLayer\.push\(arguments\)\}[\s\S]*?<\/script>/gi;
  const inlineMatches = html.match(inlineGtag) || [];
  if (inlineMatches.length > 1) {
    let first = true;
    html = html.replace(inlineGtag, (m) => {
      if (first) {
        first = false;
        return m;
      }
      removed++;
      return '';
    });
  }
  if (removed) bump('dupe-scripts', file);
  return html;
}

function removePreloader(html, file) {
  if (!/id=["']preloader["']/.test(html)) return html;
  bump('preloader', file);
  return html.replace(/<div\s+id=["']preloader["']\s*>\s*<\/div>/gi, '');
}

function removeDeadCss(html, file) {
  let changed = false;
  for (const href of DEAD_CSS) {
    const re = new RegExp(`<link[^>]*href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'gi');
    if (re.test(html)) {
      changed = true;
      html = html.replace(re, '');
    }
  }
  // Nothing on the site is served from jsDelivr except KaTeX (added below).
  if (!MATH_PAGES.includes(file)) {
    const pre = /<link[^>]*rel=["']preconnect["'][^>]*cdn\.jsdelivr\.net[^>]*>|<link[^>]*cdn\.jsdelivr\.net[^>]*rel=["']preconnect["'][^>]*>/gi;
    if (pre.test(html)) {
      changed = true;
      html = html.replace(pre, '');
    }
  }
  if (changed) bump('dead-css', file);
  return html;
}

function addMain(html, file) {
  if (/<main\b/.test(html)) return html;

  // Some pages park id="main-content" on a layout <div class="row"> deep inside
  // the article. That makes the skip link land past the heading. Reclaim the id.
  html = html.replace(/(<div[^>]*)\sid=["']main-content["']/i, '$1');

  const navEnd = html.indexOf('</nav>');
  // Fall back to the start of the first content section on pages without a nav.
  const start = navEnd !== -1 ? navEnd + 6 : html.search(/<section\b/i);
  if (start === -1 || start === 5) return html;

  let end = html.search(/<section[^>]*footer-paralax/i);
  if (end === -1 || end < start) end = html.search(/<\/body>/i);
  if (end === -1 || end < start) return html;

  bump('main-landmark', file);
  return `${html.slice(0, start)}<main id="main-content">${html.slice(start, end)}</main>${html.slice(end)}`;
}

/** Exactly one <h1> per page. Extra h1s become h2s; pages with none promote the hero. */
function fixHeadings(html, file) {
  const count = (html.match(/<h1\b/gi) || []).length;

  if (count > 1) {
    let seen = 0;
    html = html.replace(/<(\/?)h1\b([^>]*)>/gi, (tag, slash, attrs) => {
      if (!slash) {
        seen++;
        return seen === 1 ? tag : `<h2${attrs}>`;
      }
      return seen <= 1 ? tag : '</h2>';
    });
    bump('extra-h1', file);
  }

  if (count === 0) {
    // The build demotes the hero heading to a <div>; on pages with no article
    // h1 that leaves the document with no heading at all.
    const re = /<div class="([^"]*\bintro-title\b[^"]*)"([^>]*)>([\s\S]*?)<\/div>/i;
    if (re.test(html)) {
      html = html.replace(re, (m, cls, attrs, inner) => `<h1 class="${cls}"${attrs}>${inner}</h1>`);
      bump('missing-h1', file);
    }
  }
  return html;
}

function dedupeSkipLink(html, file) {
  const re = /(<a[^>]*href=["']#main-content["'][^>]*>[\s\S]{0,60}?<\/a>)\s*\1/gi;
  if (re.test(html)) {
    bump('dupe-skiplink', file);
    html = html.replace(re, '$1');
  }
  return html;
}

function fixHeroImage(html, file) {
  if (file === 'index.html') return html; // LCP there is a CSS background, already preloaded
  let done = false;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (done) return tag;
    if (/\bclass=["'][^"']*\bavatar\b/.test(tag)) return tag; // author thumbnail, keep lazy
    done = true;
    if (/data-no-lazy/.test(tag)) return tag;
    bump('lcp-eager', file);
    let out = tag
      .replace(/\s*loading=["']lazy["']/gi, '')
      .replace(/\s*decoding=["']async["']/gi, '');
    out = out.replace(/<img\b/i, '<img data-no-lazy fetchpriority="high" decoding="sync"');
    return out;
  });
}

function addImageDimensions(html, file) {
  let changed = false;
  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bwidth=/.test(tag) && /\bheight=/.test(tag)) return tag;
    const m = tag.match(/\bsrc=["']([^"']+)["']/);
    if (!m) return tag;
    const dims = dimCache[m[1]];
    if (!dims) return tag;
    changed = true;
    return tag.replace(/<img\b/i, `<img width="${dims[0]}" height="${dims[1]}"`);
  });
  if (changed) bump('img-dims', file);
  return html;
}

function pngToWebp(html, file) {
  let changed = false;
  html = html.replace(/img\/([A-Za-z0-9 ()._-]+)\.(png|jpe?g)/gi, (full, base, ext) => {
    // Icons must stay in their original format for platform compatibility.
    if (/^(favicon|apple-touch-icon)$/i.test(base)) return full;
    const webp = `img/${base}.webp`;
    if (!fs.existsSync(path.join(ROOT, webp))) return full;
    changed = true;
    return webp;
  });
  if (changed) bump('png-to-webp', file);
  return html;
}

/**
 * Several pages point og:image at files that were never committed, so social
 * previews 404. Derive it from the hero image the page actually renders.
 */
function fixOgImage(html, file) {
  const hero = html.match(/<img[^>]*\bdata-no-lazy\b[^>]*\bsrc=["']([^"']+)["']/i)
    || html.match(/<img[^>]*\bsrc=["'](img\/[^"']+)["'][^>]*\bdata-no-lazy\b/i);

  let src = hero && hero[1];
  if (!src) {
    // Placeholder pages have no <img>; fall back to the CSS hero background.
    const bg = html.match(/background-image:\s*url\(['"]?(img\/[^'")]+)['"]?\)/i);
    src = bg && bg[1];
  }
  if (!src || /favicon|apple-touch|overlay-bg|testimonial/.test(src)) return html;

  const abs = `https://bahaerdogan.com/${src.replace(/\\/g, '').replace(/ /g, '%20')}`;
  const re = /<meta[^>]*property=["']og:image["'][^>]*>|<meta[^>]*content=["'][^"']*["'][^>]*property=["']og:image["'][^>]*>/i;
  const tag = `<meta content="${abs}" property="og:image">`;

  if (re.test(html)) {
    const current = html.match(re)[0];
    if (current.includes(abs)) return html;
    bump('og-image', file);
    return html.replace(re, tag);
  }
  bump('og-image', file);
  return html.replace('</head>', `${tag}</head>`);
}

function addNoindex(html, file) {
  if (!NOINDEX.includes(file)) return html;
  if (/name=["']robots["']/i.test(html)) return html;
  bump('noindex', file);
  return html.replace(/<head>/i, '<head><meta name="robots" content="noindex,follow">');
}

function addKatex(html, file) {
  if (!MATH_PAGES.includes(file)) return html;
  if (html.includes('katex.min.css')) return html;
  bump('katex', file);
  html = html.replace('</head>', `${KATEX_CSS}</head>`);
  html = html.replace('</body>', `${KATEX_JS}</body>`);
  return html;
}

function fixEmptyHeroAlt(html, file) {
  const ALTS = {
    'MachineLearning-Explained.html': 'Diagram illustrating how a machine learning model maps inputs to predictions',
    'DistanceCalculatingMethods.html': 'Motion blur in a video frame, illustrating object speed estimation from footage',
    'MachineLearning-ExplainedTR.html': 'Bir makine öğrenimi modelinin girdileri tahminlere nasıl dönüştürdüğünü gösteren şema',
    'DistanceCalculatingMethodsTR.html': 'Videodan nesne hızı tahminini gösteren hareket bulanıklığı içeren kare',
  };
  const alt = ALTS[file];
  if (!alt) return html;
  let done = false;
  return html.replace(/<img\b([^>]*)\balt=["']["']([^>]*)>/gi, (tag, pre, post) => {
    if (done) return tag;
    done = true;
    bump('empty-alt', file);
    return `<img${pre}alt="${alt}"${post}>`;
  });
}

function removeDeLanguageLink(html, file) {
  // Don't route readers to a placeholder page.
  let changed = false;
  for (const stub of DE_STUBS) {
    const re = new RegExp(`<a[^>]*href=["']${stub}["'][^>]*>[\\s\\S]{0,40}?</a>`, 'gi');
    if (re.test(html)) {
      changed = true;
      html = html.replace(re, '');
    }
  }
  if (changed) bump('de-switcher', file);
  return html;
}

function removeDeHreflang(html, file) {
  let changed = false;
  for (const stub of DE_STUBS) {
    const re = new RegExp(`<link[^>]*href=["'][^"']*${stub}["'][^>]*hreflang=["']de["'][^>]*>|<link[^>]*hreflang=["']de["'][^>]*href=["'][^"']*${stub}["'][^>]*>`, 'gi');
    if (re.test(html)) {
      changed = true;
      html = html.replace(re, '');
    }
  }
  if (changed) bump('de-hreflang', file);
  return html;
}

// --- run ---
const files = glob.sync('*.html', { cwd: ROOT });
let touched = 0;

for (const file of files) {
  const p = path.join(ROOT, file);
  const original = fs.readFileSync(p, 'utf8');
  let html = original;

  html = fixViewport(html, file);
  html = dedupeScripts(html, file);
  html = removePreloader(html, file);
  html = removeDeadCss(html, file);
  html = dedupeSkipLink(html, file);
  html = addMain(html, file);
  html = fixHeadings(html, file);
  html = fixHeroImage(html, file);
  html = pngToWebp(html, file);
  html = addImageDimensions(html, file);
  html = fixOgImage(html, file);
  html = addNoindex(html, file);
  html = fixEmptyHeroAlt(html, file);
  html = addKatex(html, file);
  html = removeDeLanguageLink(html, file);
  html = removeDeHreflang(html, file);

  if (html !== original) {
    touched++;
    if (!DRY) fs.writeFileSync(p, html, 'utf8');
  }
}

console.log(`\n${DRY ? '[dry run] ' : ''}${touched}/${files.length} files changed\n`);
for (const [k, v] of Object.entries(stats).sort()) {
  console.log(`  ${k.padEnd(16)} ${String(v.size).padStart(3)} files`);
}

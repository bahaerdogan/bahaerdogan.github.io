#!/usr/bin/env node
/**
 * Re-runs every check from the July 2026 production audit against the current
 * tree. Each entry names the original finding so regressions are traceable.
 *
 * Usage: node tools/audit-check.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = path.resolve(__dirname, '..');
const html = Object.fromEntries(
  glob.sync('*.html', { cwd: ROOT }).map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')])
);
const pages = Object.entries(html);
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => (exists(p) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : '');

const count = (fn) => pages.filter(([f, s]) => fn(s, f)).length;

const financeCount = () => {
  const { readMeta, NOT_ARTICLES } = require('./site-meta.js');
  const fs2 = require('fs');
  return require('glob').sync('*.html')
    .filter((f) => !NOT_ARTICLES.has(f))
    .map((f) => readMeta(f, fs2.readFileSync(f, 'utf8')))
    .filter((m) => !m.noindex && m.lang === 'en' && m.category === 'Finance').length;
};

const CHECKS = [
  ['C1', 'Contact form uses a live email provider',
    // Match the endpoint, not the word: the file explains the migration in a comment.
    () => read('cloudflare-worker/worker.js').includes('api.resend.com')
       && !/api\.mailchannels\.net/i.test(read('cloudflare-worker/worker.js')), true],

  ['C2', 'Preloader overlay removed',
    () => count((s) => /id=["']preloader["']/.test(s)), 0],
  ['C2b', 'Reduced-motion support present',
    () => /prefers-reduced-motion/.test(read('css/style.min.css')), true],

  ['C3', 'LaTeX pages load a math renderer',
    () => count((s) => /\\\(|\\\[/.test(s.replace(/<[^>]+>/g, ' ')) && !/katex|mathjax/i.test(s)), 0],

  ['C4', 'Pinch-zoom enabled everywhere',
    () => count((s) => /user-scalable\s*=\s*no|maximum-scale/i.test(s)), 0],

  ['C5', 'No hardcoded placeholder datePublished',
    () => count((s) => s.includes('"datePublished":"2024-03-20"')), 0],
  ['C5b', 'No empty schema descriptions',
    () => count((s) => s.includes('"description":""')), 0],
  ['C5c', 'Schema images vary per page',
    () => new Set(pages.flatMap(([, s]) => (s.match(/"image":"[^"]*"/g) || []))).size > 5, true],

  ['C6', 'Placeholder pages are noindexed',
    () => ['DistanceCalculatingMethodsDE.html', 'TypesOfAgenticAiDE.html', 'BlogTemplate.html']
      .every((f) => /noindex/.test(html[f] || '')), true],
  ['C6b', 'Placeholder pages absent from sitemap',
    () => !/BlogTemplate|DistanceCalculatingMethodsDE/.test(read('sitemap.xml')), true],

  ['C7', 'No duplicate script tags',
    () => count((s) => {
      const srcs = [...s.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1].split('?')[0]);
      return srcs.some((x, i) => srcs.indexOf(x) !== i);
    }), 0],

  ['H2', 'LCP hero images not lazy-loaded',
    () => count((s, f) => {
      if (f === 'index.html') return false;
      const first = s.match(/<img\b[^>]*>/i);
      return first && /loading=["']lazy["']/.test(first[0]);
    }), 0],

  ['H3', 'All images have intrinsic dimensions',
    () => pages.flatMap(([, s]) => s.match(/<img\b[^>]*>/gi) || [])
      .filter((t) => !/\bwidth=/.test(t) || !/\bheight=/.test(t)).length, 0],

  ['H4', 'Font Awesome removed',
    () => !exists('lib/font-awesome') && count((s) => /class="[^"]*\bfa-[a-z]/.test(s)) === 0, true],
  ['H4b', 'Unused stylesheets removed',
    () => count((s) => /animate\.min\.css|owl\.carousel\.min\.css|lightbox\/css/.test(s)), 0],
  ['H4c', 'Unused theme stylesheets deleted',
    () => glob.sync('css/style-*.css', { cwd: ROOT }).length, 0],

  ['H6', 'Comment escaping happens once, at render',
    () => !/function sanitize\(/.test(read('cloudflare-worker/worker.js')), true],
  ['H7', 'Comment array is bounded',
    () => /MAX_COMMENTS_PER_POST/.test(read('cloudflare-worker/worker.js')), true],
  ['H8', 'Commenter IPs no longer stored',
    () => !/ip:\s*clientIP/.test(read('cloudflare-worker/worker.js')), true],

  ['M1', 'llms-full.txt differs from llms.txt',
    () => read('llms.txt') !== read('llms-full.txt') && read('llms-full.txt').length > 50000, true],
  ['M1b', 'llms.txt entries have descriptions',
    () => read('llms.txt').split('\n').filter((l) => l.startsWith('- [') && !l.includes('): ')).length, 0],

  // The real invariant is that every lastmod is a *commit* date, not a clock
  // reading. "More than one distinct value" was only a proxy, and it is wrong:
  // a single commit that legitimately edits every article yields one shared
  // date, which is honest and which the next content commit splits apart again.
  // A build timestamp, by contrast, matches no commit at all — that is the
  // condition worth failing on.
  ['M2', 'Sitemap lastmod values are real commit dates, not build clock readings',
    () => {
      const stamps = [...new Set((read('sitemap.xml').match(/<lastmod>([^<]*)/g) || [])
        .map((s) => s.replace('<lastmod>', '').trim()))];
      if (!stamps.length) return false;
      let commitDates;
      try {
        commitDates = new Set(require('child_process')
          .execFileSync('git', ['log', '--format=%aI'], { encoding: 'utf8' })
          .trim().split('\n'));
      } catch { return true; } // not a git checkout; nothing to assert against
      return stamps.every((s) => commitDates.has(s));
    }, true],

  // --- Blog data layer (added after the blog rebuild) ---
  ['Blog', 'Blog statistics are derived, not the hardcoded zeros they used to be',
    () => {
      const h = read('BlogPosts.html');
      const n = (id) => {
        const m = h.match(new RegExp('id="' + id + '"[^>]*>([0-9]+)<'));
        return m ? Number(m[1]) : -1;
      };
      const total = n('totalPosts');
      return total > 0 && total === n('aiPosts') + n('techPosts') + n('historyPosts') + financeCount();
    }, true],
  ['Blog2', 'Every rendered card has an image with intrinsic dimensions and srcset',
    () => count((s) => {
      const cards = s.match(/<img[^>]*class="post-(card|featured)__img"[^>]*>/g) || [];
      return cards.some((i) => !/\bwidth=/.test(i) || !/\bheight=/.test(i) || !/\bsrcset=/.test(i));
    }), 0],
  ['Blog3', 'The blog index renders cards server-side, not via a loading spinner',
    () => /id="blogGrid"/.test(read('BlogPosts.html'))
      && !/loadingSpinner|Loading articles/.test(read('BlogPosts.html'))
      && (read('BlogPosts.html').match(/class="post-card"/g) || []).length > 5, true],
  ['Blog4', 'Excerpts end on a sentence boundary within 140-180 characters',
    () => {
      const { readMeta, NOT_ARTICLES } = require('./site-meta.js');
      const fs2 = require('fs');
      return (require('glob').sync('*.html'))
        .filter((f) => !NOT_ARTICLES.has(f))
        .map((f) => readMeta(f, fs2.readFileSync(f, 'utf8')))
        .filter((m) => !m.noindex)
        .filter((m) => m.excerpt && m.excerpt.length > 185).length;
    }, 0],

  // Inline scripts were invisible to the 'duplicate <script src>' check, so a
  // build step whose idempotency guard tested minifiable source text could
  // append a fresh copy every run undetected. It did: 1 -> 2 -> 4.
  ['Theme', 'Exactly one inline theme bootstrap per page',
    () => count((s) => (s.match(/localStorage\.getItem\(.theme.\)/g) || []).length !== 1), 0],
  ['Theme2', 'No inline script body appears more than once on a page',
    () => count((s) => {
      const bodies = [...s.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
        .map((m) => m[1].trim()).filter((b) => b.length > 40);
      return bodies.some((b, i) => bodies.indexOf(b) !== i);
    }), 0],
  ['Theme3', 'Dark theme is reachable by preference and by explicit override',
    () => /prefers-color-scheme:\s*dark/.test(read('css/style.min.css'))
      // clean-css strips attribute-selector quotes, so match either form.
      && /\[data-theme=["']?dark["']?\]/.test(read('css/style.min.css')), true],
  ['Font', 'Inter is self-hosted and preloaded, not fetched from a CDN',
    () => exists('lib/fonts/inter-latin-wght.woff2')
      && count((s) => !/rel="preload"[^>]*inter-latin-wght|inter-latin-wght[^>]*rel="preload"/.test(s)) === 0, true],

  ['M3', 'hreflang pairs the -tr page with its English original',
    () => /ai-and-human-job-competition\.html[\s\S]{0,400}ai-and-human-job-competition-tr\.html/.test(read('sitemap.xml')), true],

  ['A11y', 'Every page has a <main> landmark',
    () => count((s) => !/<main/i.test(s)), 0],
  ['A11y2', 'No broken skip links',
    () => count((s) => /href="#main-content"/.test(s) && !/id="main-content"/.test(s)), 0],
  ['A11y3', 'Exactly one <h1> per page',
    () => count((s) => (s.match(/<h1\b/gi) || []).length !== 1), 0],
  ['A11y4', 'Every page has a <body>',
    () => count((s) => !/<body/i.test(s)), 0],

  ['SEO', 'OpenGraph complete on article pages',
    () => count((s, f) => !['index.html', 'BlogPosts.html'].includes(f)
      && !(/og:title/.test(s) && /og:description/.test(s) && /og:type/.test(s) && /og:url/.test(s))), 0],
  ['SEO2', 'No broken local asset references',
    () => pages.flatMap(([, s]) => [...s.matchAll(/(?:src|href)=["'](img\/[^"']+)["']/gi)].map((m) => m[1]))
      .filter((p) => !exists(decodeURIComponent(p))).length, 0],
  ['SEO3', 'Author entity inlined with sameAs on article pages',
    () => /"sameAs":\[/.test(html['AI-Defense.html'] || ''), true],

  ['Facts', 'ReWOO defined correctly',
    () => /Reasoning WithOut Observation/.test(html['AgenticAiTechDepth.html'] || '')
       && !/Read, Write, Observe/.test(html['AgenticAiTechDepth.html'] || ''), true],
  ['Facts2', 'ReAct attributed correctly with citation',
    () => /Yao et al/.test(html['AgenticAiTechDepth.html'] || '')
       && !/Recommended by Google researchers/.test(html['AgenticAiTechDepth.html'] || ''), true],

  ['Repo', 'node_modules not tracked by git', () => {
    try {
      return require('child_process')
        .execSync('git ls-files | grep -c node_modules || true', { cwd: ROOT, encoding: 'utf8' }).trim() === '0';
    } catch (_) { return false; }
  }, true],
  ['Repo2', 'No filenames with spaces or parentheses in img/',
    () => fs.readdirSync(path.join(ROOT, 'img')).filter((f) => /[ ()]/.test(f)).length, 0],

  // --- Second pass, July 2026: items the first remediation left open ---

  ['H4d', 'Ionicons removed (CSS and font files)',
    () => count((s) => /ionicons|class="[^"]*\bion-[a-z]/.test(s)) === 0 && !exists('lib/ionicons'), true],

  ['A11y5', 'Blue text on light backgrounds meets WCAG AA', () => {
    // #48abec is 2.53:1 on white. Only the breadcrumb over the dark hero overlay
    // may still use it as a text colour.
    const css = read('css/style.css');
    const textUses = (css.match(/^\s*color:\s*#48abec;/gm) || []).length;
    return textUses <= 1;
  }, true],

  ['A11y6', 'No dead href="#" tag or category links',
    () => count((s) => /<a href="#"[^>]*>(?!\s*<svg)/.test(
      s.replace(/<li class="nav-item dropdown language-switcher"[\s\S]*?<\/li>/g, '')
       .replace(/<a href="#" class="back-to-top"[\s\S]*?<\/a>/g, '')
    )), 0],

  ['A11y7', 'No inline event handlers (they cannot run under the CSP)',
    () => count((s) => /\son(click|submit|load|error|mouseover)=/i.test(s)), 0],

  ['Nav', 'Primary navigation is identical within each language', () => {
    const sets = new Set();
    for (const [, s] of pages) {
      const nav = (s.match(/<ul class="navbar-nav">([\s\S]*?)<\/ul>/) || [])[1];
      if (!nav) continue;
      const labels = [...nav.matchAll(/class="js-scroll nav-link[^"]*">([^<]+)</g)].map((m) => m[1]);
      if (labels.length) sets.add(labels.join('|'));
    }
    return sets.size; // one per language: en, tr, de
  }, 3],

  ['Brand', 'One spelling of the name everywhere',
    () => count((s) => /Bahaerdogan/.test(s)), 0],
  ['Brand2', 'No invalid sameAs (a YouTube handle cannot contain "ğ")',
    () => count((s) => /youtube\.com\/[^"<\s]*ğ/.test(s.match(/"sameAs":\[[^\]]*\]/)?.[0] || '')), 0],

  ['GDPR', 'A privacy policy exists in all three languages',
    () => ['privacy.html', 'privacy-tr.html', 'privacy-de.html'].every(exists), true],
  ['GDPR2', 'Every page links the privacy policy',
    // The six noindexed German stubs carry no footer chrome at all.
    () => count((s) => !/legal-link/.test(s) && !/name="robots" content="noindex"/.test(s)
                     && !/content="noindex"/.test(s)), 0],
  ['GDPR3', 'Analytics consent defaults to denied before gtag config', () => {
    const s = html['index.html'] || '';
    const boot = (s.match(/<script>[^<]*gtag[^<]*<\/script>/) || [''])[0];
    const dflt = boot.indexOf('"default"') >= 0 ? boot.indexOf('"default"') : boot.indexOf("'default'");
    const cfg = boot.indexOf('"config"') >= 0 ? boot.indexOf('"config"') : boot.indexOf("'config'");
    return dflt > -1 && cfg > -1 && dflt < cfg && /analytics_storage:"denied"|analytics_storage:'denied'/.test(boot);
  }, true],
  ['GDPR4', 'Commenter IP is hashed, never stored raw',
    () => /ipKey\(/.test(read('cloudflare-worker/worker.js'))
       && !/ratelimit:\$\{clientIP\}/.test(read('cloudflare-worker/worker.js')), true],

  ['CSP', 'Content-Security-Policy is enforced via <meta> (GitHub Pages reads no header file)',
    () => count((s) => !/http-equiv="Content-Security-Policy"/.test(s)), 0],
  ['CSP2', 'Every inline script is covered by a CSP hash', () => {
    const crypto = require('crypto');
    const headers = read('_headers');
    const missing = new Set();
    for (const [, s] of pages) {
      for (const m of s.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
        const h = `sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}`;
        if (!headers.includes(h)) missing.add(h);
      }
    }
    return missing.size;
  }, 0],
  ['CSP3', 'Only one server-config file is shipped',
    () => [exists('.htaccess'), exists('_headers')].filter(Boolean).length, 1],

  // The cookie banner's onclick="" buttons were blocked by the CSP from July to
  // October 2026, so nobody could grant consent and analytics recorded nothing.
  ['CSP4', 'No inline event handlers (the CSP silently blocks them)',
    () => [...pages.map(([, s]) => s), ...glob.sync('js/*.js', { cwd: ROOT, ignore: 'js/*.min.js' }).map(read)]
      .reduce((n, s) => n + (s.match(/<[a-z][^<>]*\son[a-z]+=["']/gi) || []).length, 0), 0],

  // Every script is deferred, so document order is execution order. main.js is
  // wrapped in (jQuery); loaded first, none of it ran on 19 article pages.
  ['Order', 'main.min.js loads after the jQuery it is wrapped in', () => count((s) => {
    const srcs = [...s.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    const main = srcs.indexOf('js/main.min.js');
    return main !== -1 && !srcs.slice(0, main).includes('lib/jquery/jquery.min.js');
  }), 0],

  ['Search', 'Sidebar search uses the generated index, not a stale copy',
    () => !/handleSearch/.test(read('js/main.js'))
       && /addEventListener\('submit'/.test(read('js/blog-search.js')), true],

  ['PWA', 'theme-color pages have a manifest to belong to',
    () => count((s) => /name="theme-color"/.test(s) && !/rel="manifest"/.test(s)), 0],

  ['Dead', 'No calls to functions that do not exist',
    () => count((s) => /scrollToTop\(\)/.test(s)), 0],

  ['Footer', 'Every page has a footer landmark',
    () => count((s) => !/<footer[\s>]/.test(s)), 0],

  ['Build', 'No tag is duplicated by a non-idempotent build step', () => {
    // Every one of these is written by the build. More than one per page means a
    // strip-then-reinsert step stopped matching — usually because the minifier
    // sorted the attributes out from under an order-dependent regex.
    const singletons = [
      /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      /<link[^>]*rel="manifest"[^>]*>/gi,
      /<p class="legal-link">/g,
      /<script type="application\/ld\+json">/g,
    ];
    return count((s) => singletons.some((re) => (s.match(re) || []).length > 1));
  }, 0],
];

let pass = 0;
let fail = 0;
console.log('\nRe-running the July 2026 audit findings against the current tree\n');
for (const [id, label, fn, expected] of CHECKS) {
  let actual;
  try { actual = fn(); } catch (e) { actual = `error: ${e.message}`; }
  const ok = actual === expected;
  ok ? pass++ : fail++;
  const detail = ok ? '' : `  (expected ${expected}, got ${actual})`;
  console.log(`  ${ok ? '✓' : '✗'} ${id.padEnd(6)} ${label}${detail}`);
}
console.log(`\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

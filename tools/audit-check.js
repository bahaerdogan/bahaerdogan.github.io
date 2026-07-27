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
    () => read('llms.txt').split('\n').filter((l) => l.startsWith('- [') && !l.includes(' — ')).length, 0],

  ['M2', 'Sitemap lastmod is not a single build timestamp',
    () => new Set(read('sitemap.xml').match(/<lastmod>[^<]*/g) || []).size > 1, true],

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

#!/usr/bin/env node
/**
 * Round-trip editor for article prose.
 *
 * The pages are their own source: `build.js` minifies them in place, so the
 * article text lives on one line inside several kilobytes of markup. Editing it
 * there is how the TR/DE copies drifted apart and how half the German pages
 * were left as placeholders without anyone noticing.
 *
 *   node tools/article-content.js extract <dir> [page.html ...]
 *     Writes <dir>/<page>.txt per article: a small header (title, h1,
 *     description, tags) and the `.article-content` body, one block per line.
 *
 *   node tools/article-content.js apply <dir> [page.html ...]
 *     Writes those files back. A header may also carry `create-from:` (a page
 *     to clone when the target does not exist yet) and `image-from:` (a page
 *     whose featured image the new page should reuse).
 *
 * Heading ids are dropped on extract; the build derives them from the heading
 * text, so a reworded heading gets a matching anchor and TOC entry.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { parse } = require('node-html-parser');
const { NOT_ARTICLES } = require('./site-meta.js');

const ROOT = path.resolve(__dirname, '..');
const BLOCKS = new Set(['ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'blockquote', 'div', 'figure', 'section']);
const FIELDS = ['title', 'h1', 'description', 'tags', 'create-from', 'image-from'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

function pretty(node, depth = 0) {
  const pad = '  '.repeat(depth);
  const out = [];
  for (const c of node.childNodes) {
    if (c.nodeType === 3) {
      const t = c.rawText.trim();
      if (t) out.push(pad + t);
      continue;
    }
    if (c.nodeType !== 1) continue;
    const tag = c.rawTagName.toLowerCase();
    if (/^h[2-6]$/.test(tag)) c.removeAttribute('id');
    // Only expand containers of blocks. One that holds running text mixed with
    // inline tags stays on one line, or the spaces around those tags are lost.
    const mixed = c.childNodes.some((n) => n.nodeType === 3 && n.rawText.trim());
    if (BLOCKS.has(tag) && !mixed && c.childNodes.some((n) => n.nodeType === 1)) {
      const open = c.outerHTML.slice(0, c.outerHTML.indexOf('>') + 1);
      out.push(pad + open, ...pretty(c, depth + 1), `${pad}</${c.rawTagName}>`);
    } else {
      out.push(pad + c.outerHTML);
    }
  }
  return out;
}

function articlePages(args) {
  const files = args.length ? args : glob.sync('*.html', { cwd: ROOT });
  return files.filter((f) => !NOT_ARTICLES.has(f));
}

function extract(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const file of articlePages(files)) {
    const root = parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const content = root.querySelector('.article-content');
    if (!content) { console.warn(`  ⚠ ${file}: no .article-content`); continue; }
    const head = [
      `title: ${root.querySelector('title')?.text.trim() || ''}`,
      `h1: ${root.querySelector('h1.article-title')?.text.trim() || ''}`,
      `description: ${root.querySelector('meta[name="description"]')?.getAttribute('content') || ''}`,
      `tags: ${root.querySelectorAll('.widget-tags .tag').map((t) => t.text.trim()).join(', ')}`,
    ];
    fs.writeFileSync(path.join(dir, file.replace(/\.html$/, '.txt')), `${head.join('\n')}\n---\n${pretty(content).join('\n')}\n`);
    n++;
  }
  console.log(`extracted ${n} articles → ${dir}`);
}

function readSource(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const split = raw.indexOf('\n---\n');
  if (split < 0) throw new Error(`${p}: missing '---' separator`);
  const fields = {};
  for (const line of raw.slice(0, split).split('\n')) {
    const m = line.match(/^([a-z0-9-]+):\s*(.*)$/);
    if (!m || !FIELDS.includes(m[1])) throw new Error(`${p}: bad header line "${line}"`);
    fields[m[1]] = m[2].trim();
  }
  // Line breaks are kept: they are whitespace to the minifier everywhere except
  // inside <pre>, where they are the content.
  const body = raw.slice(split + 5).trim();
  return { fields, body };
}

function apply(dir, files) {
  const sources = files.length
    ? files.map((f) => path.join(dir, f.replace(/\.html$/, '.txt')))
    : glob.sync('*.txt', { cwd: dir }).map((f) => path.join(dir, f));
  let n = 0;
  for (const src of sources) {
    const file = path.basename(src).replace(/\.txt$/, '.html');
    const target = path.join(ROOT, file);
    const { fields, body } = readSource(src);

    if (!fs.existsSync(target)) {
      if (!fields['create-from']) throw new Error(`${file} does not exist and has no create-from`);
      fs.copyFileSync(path.join(ROOT, fields['create-from']), target);
    }
    const root = parse(fs.readFileSync(target, 'utf8'));

    if (fields['image-from']) {
      const donor = parse(fs.readFileSync(path.join(ROOT, fields['image-from']), 'utf8')).querySelector('.post-thumb img');
      const img = root.querySelector('.post-thumb img');
      if (!donor || !img) throw new Error(`${file}: image-from needs a .post-thumb img on both pages`);
      for (const a of ['src', 'width', 'height']) img.setAttribute(a, donor.getAttribute(a));
      // Both ends of the swap have to agree, or the social card shows the
      // template's picture while the page shows the article's.
      const og = root.querySelector('meta[property="og:image"]');
      if (og) og.setAttribute('content', `https://bahaerdogan.com/${donor.getAttribute('src')}`);
    }

    if (fields.title) root.querySelector('title').set_content(esc(fields.title));
    if (fields.description != null) {
      const d = root.querySelector('meta[name="description"]');
      if (d) d.setAttribute('content', fields.description);
      else root.querySelector('head').insertAdjacentHTML('beforeend', `<meta name="description" content="${escAttr(fields.description)}">`);
    }
    if (fields.h1) {
      root.querySelector('h1.article-title').set_content(esc(fields.h1));
      const img = root.querySelector('.post-thumb img');
      if (img) img.setAttribute('alt', fields.h1);
    }
    if (fields.tags) {
      const ul = root.querySelector('.widget-tags ul');
      if (ul) ul.set_content(fields.tags.split(',').map((t) => `<li><span class="tag">${esc(t.trim())}</span></li>`).join(''));
    }
    // A cloned page must not stay noindexed just because its template was.
    if (fields['create-from']) root.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());

    root.querySelector('.article-content').set_content(body);
    fs.writeFileSync(target, root.toString());
    n++;
  }
  console.log(`applied ${n} articles`);
}

const [cmd, dir, ...files] = process.argv.slice(2);
if (cmd === 'extract' && dir) extract(path.resolve(dir), files);
else if (cmd === 'apply' && dir) apply(path.resolve(dir), files);
else {
  console.error('usage: article-content.js extract|apply <dir> [page.html ...]');
  process.exit(1);
}

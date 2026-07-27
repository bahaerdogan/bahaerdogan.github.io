#!/usr/bin/env node
/**
 * Replace the nine Font Awesome glyphs the site actually uses with inline SVG,
 * then drop the stylesheet and its four font files.
 *
 * Font Awesome was costing ~30 KB of render-blocking CSS plus ~500 KB of font
 * files to draw nine icons. Inline SVG has no extra request, no FOIT, and is
 * correctly hidden from assistive tech.
 *
 * Idempotent: re-running finds no <i class="fa …"> left and changes nothing.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = path.resolve(__dirname, '..');

// 24x24 viewBox, stroke-based so icons inherit currentColor and line weight.
const S = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon"';

const ICONS = {
  'fa-chevron-up': `<svg ${S}><polyline points="18 15 12 9 6 15"/></svg>`,
  'fa-arrow-up': `<svg ${S}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  'fa-arrow-right': `<svg ${S}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  'fa-search': `<svg ${S}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  'fa-language': `<svg ${S}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  'fa-image': `<svg ${S}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  'fa-user-circle': `<svg ${S}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19.5a6.5 6.5 0 0 1 11 0"/></svg>`,
  'fa-clock-o': `<svg ${S}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  'fa-spinner': `<svg ${S} class="icon icon-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
};

// `<i class="fa fa-x …"></i>` and the `<span>` variant.
const TAG = /<(i|span)\s+class="([^"]*\bfa\b[^"]*)"[^>]*>\s*<\/\1>/gi;

function replaceIcons(html) {
  return html.replace(TAG, (whole, tag, cls) => {
    const key = Object.keys(ICONS).find((k) => new RegExp(`\\b${k}\\b`).test(cls));
    if (!key) return whole;
    return ICONS[key];
  });
}

function dropStylesheet(html) {
  return html.replace(/<link[^>]*font-awesome[^>]*>/gi, '');
}

let changed = 0;
for (const file of glob.sync('*.html', { cwd: ROOT })) {
  const p = path.join(ROOT, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = dropStylesheet(replaceIcons(before));
  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8');
    changed++;
  }
}

// The spinner is injected from JS, so it needs the same treatment there.
for (const file of ['js/contact.js', 'js/comments-system.js', 'js/comments-system-tr.js']) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  const before = fs.readFileSync(p, 'utf8');
  const after = before.replace(/<i class="fa fa-spinner fa-spin"><\/i>/g, ICONS['fa-spinner'].replace(/"/g, "'"));
  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8');
    changed++;
  }
}

const leftover = glob.sync('*.html', { cwd: ROOT })
  .filter((f) => /class="[^"]*\bfa-[a-z]/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));

console.log(`Replaced Font Awesome glyphs in ${changed} files`);
if (leftover.length) console.warn(`  ⚠ still contain fa- classes: ${leftover.join(', ')}`);
else console.log('  no fa- classes remain — stylesheet and fonts can be deleted');

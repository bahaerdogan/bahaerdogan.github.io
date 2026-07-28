#!/usr/bin/env node
/**
 * Replace the fourteen Ionicons glyphs the site actually uses with inline SVG,
 * then drop the stylesheet and its four font files.
 *
 * Ionicons was costing ~51 KB of render-blocking CSS plus ~800 KB of font files
 * (eot/woff/ttf/svg) to draw fourteen icons. Inline SVG has no extra request, no
 * FOIT, and is correctly hidden from assistive tech.
 *
 * Four more glyphs — facebook, instagram, pinterest, twitter — are NOT converted.
 * They are template leftovers wrapped in `<a href="">`, and an empty href
 * re-navigates to the current page. The whole <li> is removed instead.
 *
 * Idempotent: re-running finds no `ion-` classes left and changes nothing.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = path.resolve(__dirname, '..');

// Stroke-based, 24x24, so UI icons inherit currentColor and line weight.
const S = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="icon"';

// Brand marks are filled single paths — outlines misrender at 1em.
const B = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false" class="icon"';

const GITHUB = `<svg ${B}><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`;

const LINKEDIN = `<svg ${B}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;

const YOUTUBE = `<svg ${B}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;

const MAIL = `<svg ${S}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,7 12,13 2,7"/></svg>`;

const ICONS = {
  // Longest keys first — `ion-social-linkedin-outline` must win over
  // `ion-social-linkedin`, and `ion-ios-email` over `ion-email`.
  'ion-social-linkedin-outline': LINKEDIN,
  'ion-social-youtube-outline': YOUTUBE,
  'ion-ios-clock-outline': `<svg ${S}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  'ion-android-search': `<svg ${S}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  'ion-social-linkedin': LINKEDIN,
  'ion-ios-telephone': `<svg ${S}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  'ion-social-github': GITHUB,
  'ion-ios-location': `<svg ${S}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  'ion-logo-github': GITHUB,
  'ion-ios-person': `<svg ${S}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  'ion-ios-email': MAIL,
  'ion-pricetag': `<svg ${S}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  'ion-chatbox': `<svg ${S}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  'ion-email': MAIL,
};

// Ordered longest-first so prefix collisions resolve correctly.
const KEYS = Object.keys(ICONS).sort((a, b) => b.length - a.length);

// Template social links that go nowhere: `<li><a href=""><span class="ico-circle">
// <i class="ion-social-x"></i></span></a></li>`. An empty href re-navigates to the
// current page, so the entire list item is dropped.
const DEAD_SOCIALS = /<li>\s*<a\s+href=""\s*>\s*<span class="ico-circle">\s*<i class="ion-social-(?:facebook|instagram|pinterest|twitter)"><\/i>\s*<\/span>\s*<\/a>\s*<\/li>/gi;

// `<span class="ion-x"></span>` and the `<i>` variant, both always empty.
const TAG = /<(i|span)\s+class="([^"]*\bion-[a-z0-9-]+[^"]*)"\s*>\s*<\/\1>/gi;

function replaceIcons(html) {
  return html.replace(TAG, (whole, tag, cls) => {
    const key = KEYS.find((k) => new RegExp(`(^|\\s)${k}(\\s|$)`).test(cls));
    return key ? ICONS[key] : whole;
  });
}

function dropStylesheet(html) {
  return html.replace(/<link[^>]*ionicons[^>]*>\s*/gi, '');
}

let changed = 0;
let socialsDropped = 0;

for (const file of glob.sync('*.html', { cwd: ROOT })) {
  const p = path.join(ROOT, file);
  const before = fs.readFileSync(p, 'utf8');

  const deadCount = (before.match(DEAD_SOCIALS) || []).length;
  const after = dropStylesheet(replaceIcons(before.replace(DEAD_SOCIALS, '')));

  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8');
    changed++;
    socialsDropped += deadCount;
  }
}

console.log(`Replaced Ionicons glyphs in ${changed} files`);
if (socialsDropped) console.log(`  removed ${socialsDropped} dead template social links (href="")`);

const leftover = glob.sync('*.html', { cwd: ROOT })
  .filter((f) => /class="[^"]*\bion-[a-z]/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));

if (leftover.length) {
  console.warn(`  ⚠ still contain ion- classes: ${leftover.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('  no ion- classes remain — stylesheet and fonts can be deleted');
}

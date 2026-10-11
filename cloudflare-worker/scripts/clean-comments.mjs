#!/usr/bin/env node
/**
 * One-off cleanup of the comments the October 2025 Worker left in KV.
 *
 *   node scripts/clean-comments.mjs           dry run: prints what would change
 *   node scripts/clean-comments.mjs --apply   backs up every key, then rewrites it
 *
 * Needs `npx wrangler login` first. For every comments:<slug> key it:
 *   - removes the comments in JUNK_IDS (bot gibberish and development test posts);
 *   - decodes the HTML entities the old Worker stored, which readers saw as "There&#x27;s";
 *   - drops the commenter email and IP the old Worker kept, matching what worker.js stores now;
 *   - rewrites the key with no expiry. The old Worker put a one-year TTL on each post's whole
 *     list, renewed only by a new comment, so a post that went quiet for a year lost them all.
 * Comments whose key expired before this runs are restored from the public snapshot taken on
 * 2026-10-11 (backups/snapshot-2026-10-11, one file per post as GET /comments/<slug> returned it).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

const APPLY = process.argv.includes('--apply');
const SNAPSHOT_DIR = 'backups/snapshot-2026-10-11';

const JUNK_IDS = new Set([
  '1761646766834-t8k4jxnhv', // AI-Defense: tOZbwjKaUeBiDdVqlC
  '1761069765862-34yzzzyde', // AI-Defense: Test User 3
  '1767718216561-lc2bxl6sq', // AgenticAiExplained: JCBWLWREIaouaNKgmjuLyq
  '1764255878290-6gtk48dh8', // AgenticAiExplained: VVUaHNrHHvUCDqwW
  '1761089266412-c6r8ii4lg', // AgenticAiExplained: rGOFRRBLojfvkoMbemAnz
  '1761069086294-74rczx0u8', // AgenticAiExplained: Test User 2
  '1760223464094-8rq3ytpg0', // AgenticAiTechDepthTR: Test Kullanıcı
  '1760260781490-7u3p3gz8s', // AlgorithmsExplained: Baha Test
  '1764059098198-ee3hltvxb', // DeservingMoney: nYdVPBQhUNMgqYALv
  '1760530383634-9pngshwt8', // DeservingMoney: asasas
  '1764070824520-zmbpd7mjv', // DistanceCalculatingMethods: kTvwPFygNQlqrGMmcUG
  '1761591738272-jluqbbhd6', // DistanceCalculatingMethods: RCaXIZhyWbtqZOZrUSZBe
  '1761814829115-vpqwedrct', // ErgenekonEpic: PafXpNnzdiHEGdRUA
  '1765671658858-30kdwouzj', // MachineLearning-Explained: kxezKGTNirpLEVxrJksNZL
  '1763699375953-zo8nvvrk2', // PreciousMetalData: KGdOmFNDOrwhwFocXgwzqQDl
  '1761069058152-ketq5483j', // PreciousMetalData: Test User Task 4.2
]);

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&#x2f;': '/', '&#47;': '/' };
const decode = (s) => String(s).replace(/&(?:amp|lt|gt|quot|#x27|#39|#x2f|#47);/gi, (m) => ENTITIES[m.toLowerCase()]);

/** Records written by the old Worker carry email/ip; snapshot records are all from it. */
const isLegacy = (c) => 'email' in c || 'ip' in c;

/**
 * Keys like comments:test-post were left by testing the Worker and back no page. Rewriting
 * them would drop their expiry and keep them forever, so they are left to expire.
 */
const hasPage = (slug) => fs.existsSync(path.join('..', `${slug}.html`));

const normalize = (c) => ({
  id: c.id,
  name: decode(c.name),
  message: decode(c.message),
  date: new Date(c.timestamp).toISOString(),
  timestamp: c.timestamp,
});

function kv(...args) {
  return execFileSync('npx', ['wrangler', 'kv', ...args, '--binding', 'KV_COMMENTS', '--remote'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Wrangler can print a banner around the value, so take the outermost JSON array. */
function parseArray(out) {
  const start = out.indexOf('[');
  const end = out.lastIndexOf(']');
  if (start === -1 || end < start) throw new Error(`expected a JSON array, got: ${out.slice(0, 200)}`);
  return JSON.parse(out.slice(start, end + 1));
}

const keys = parseArray(kv('key', 'list', '--prefix', 'comments:'));
const live = new Map();
for (const { name, expiration } of keys) {
  const raw = kv('key', 'get', name);
  live.set(name.slice('comments:'.length), { raw, comments: parseArray(raw), expiration });
}

const snapshot = new Map(
  fs.readdirSync(SNAPSHOT_DIR).map((f) => [
    f.replace(/\.json$/, ''),
    JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf8')).comments,
  ]),
);

const plan = [];
const orphans = [];
for (const slug of new Set([...live.keys(), ...snapshot.keys()])) {
  if (!hasPage(slug)) {
    orphans.push(slug);
    continue;
  }
  const current = live.get(slug);
  const kept = current ? current.comments : [];
  const known = new Set(kept.map((c) => c.id));
  const restored = (snapshot.get(slug) || []).filter((c) => !known.has(c.id));

  const all = [...kept.map((c) => [c, isLegacy(c)]), ...restored.map((c) => [c, true])];
  const removed = all.filter(([c]) => JUNK_IDS.has(c.id)).map(([c]) => c.name);
  const cleaned = all
    .filter(([c]) => !JUNK_IDS.has(c.id))
    .map(([c, legacy]) => (legacy ? normalize(c) : c))
    .sort((a, b) => a.timestamp - b.timestamp);

  const next = JSON.stringify(cleaned);
  if (current && !current.expiration && next === JSON.stringify(current.comments)) continue;
  if (!current && !cleaned.length) continue;

  plan.push({ slug, current, next, removed, restored: restored.length, kept: cleaned.length });
  const expiry = current?.expiration ? new Date(current.expiration * 1000).toISOString().slice(0, 16) + 'Z' : 'none';
  console.log(`${slug}`);
  console.log(`  keep ${cleaned.length}, remove ${removed.length}${removed.length ? ` (${removed.join(', ')})` : ''}`);
  if (!current) console.log(`  key has expired; restoring ${restored.length} from the snapshot`);
  else if (restored.length) console.log(`  restoring ${restored.length} missing from KV`);
  console.log(`  expiry ${expiry} -> none`);
}

if (orphans.length) {
  console.log(`Left alone, no page on the site (they expire on their own): ${orphans.join(', ')}`);
}

if (!plan.length) {
  console.log('Nothing to change.');
} else if (!APPLY) {
  console.log(`\nDry run: ${plan.length} key(s) would be rewritten. Re-run with --apply to write them.`);
} else {
  const dir = path.join('backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  for (const { slug, current } of plan) {
    if (current) fs.writeFileSync(path.join(dir, `${slug}.json`), current.raw);
  }
  console.log(`\nBacked up the current values to ${dir}/`);
  for (const { slug, next } of plan) {
    const file = path.join(dir, `${slug}.new.json`);
    fs.writeFileSync(file, next);
    kv('key', 'put', `comments:${slug}`, '--path', file);
    console.log(`  wrote comments:${slug}`);
  }
}

#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
/**
 * Two build-time guards, run from CI's `verify` job.
 *
 * 1. Poem image URLs must go through optimizeUrl()/gridThumb(). The home carousel shipped
 *    untransformed originals for months — 1.2MB PNGs on the largest-contentful-paint
 *    element — purely because optimizeUrl was module-local to Poems.tsx and the carousel
 *    never imported it. Nothing failed; the images just arrived slowly.
 *
 * 2. Bundle budgets on the gzipped output, which is what actually crosses the wire.
 *    Deliberately close to current size so growth surfaces as a failure to think about
 *    rather than a number nobody reads.
 */
import { gzipSync } from 'node:zlib';

const WEB = new URL('../packages/web/', import.meta.url).pathname;
// `.js`/`.css` mark which extensions count toward the payload; `initial` is the budget
// that actually gates. Raised from 118KB when PoemsContext began seeding from POEMS:
// importing the poems as a value rather than a type puts all 34 of them in the entry
// chunk, +11.2KB gzipped. That buys a page that still renders when the API is down and
// stops React blanking the prerendered HTML on mount, which is worth it on a site whose
// content is the product. Raised again for the privacy notice's copy, which lives in both
// locale files; ~9KB of headroom above the current 127.1KB.
const BUDGET_GZIP = { '.js': true, '.css': true, initial: 136 * 1024 };

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

// ---- 1. raw poem image URLs -------------------------------------------------
const SAFE = /optimizeUrl\(|fullBleedSrcSet\(|gridThumb\(|imagePreview|PLACEHOLDER_IMAGE/;
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return ['.ts', '.tsx'].includes(extname(e.name)) ? [p] : [];
  });

let scanned = 0;
for (const file of walk(join(WEB, 'src'))) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      // an image URL flowing into a <img src>, a srcSet, or Image().src
      if (!/(\bsrc=\{|srcSet=\{|\.src\s*=)/.test(line)) return;
      if (!/\.image\b/.test(line)) return;
      scanned++;
      if (!SAFE.test(line)) {
        fail(
          `${file.replace(WEB, 'packages/web/')}:${i + 1} uses a poem image URL without optimizeUrl(): ${line.trim()}`,
        );
      }
    });
}
console.log(`✓ image URLs: ${scanned} image assignment(s) all transformed`);

// ---- 2. bundle budgets ------------------------------------------------------
const assets = join(WEB, 'dist/assets');
try {
  statSync(assets);
} catch {
  console.error('✗ no dist/assets — run the build first');
  process.exit(1);
}
// Budget the initial payload — the entry chunks every visitor downloads — rather than
// each file. Per-file budgets get weaker every time a route is split out: the numbers all
// drop, nothing fails, and a lazy chunk could grow unnoticed. Route chunks (Admin) are
// deliberately not budgeted against the initial payload; they cost only the person who opens
// that route. They do get a ceiling of their own — see LAZY_MAX_GZIP.
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
const entry = readdirSync(assets).filter((n) => n.startsWith('index-'));
const lazy = readdirSync(assets).filter((n) => !n.startsWith('index-') && BUDGET_GZIP[extname(n)]);

let initial = 0;
for (const name of entry) {
  const ext = extname(name);
  if (!BUDGET_GZIP[ext]) continue;
  const size = gzipSync(readFileSync(join(assets, name))).length;
  initial += size;
  console.log(`  entry ${name}: ${kb(size)} gzipped`);
}
if (initial > BUDGET_GZIP.initial) {
  fail(`initial payload is ${kb(initial)} gzipped, over the ${kb(BUDGET_GZIP.initial)} budget`);
} else {
  console.log(`✓ initial payload: ${kb(initial)} gzipped (budget ${kb(BUDGET_GZIP.initial)})`);
}
/**
 * A ceiling on any single lazy chunk, so one becoming large is a decision someone makes on
 * purpose rather than something nobody sees. These were previously printed and explicitly
 * "not budgeted", which is fine right up until a route quietly pulls in a viewer library —
 * Qalor shipped 1.54MB of PDF viewer on a modal click that way, and nothing said a word.
 *
 * Deliberately loose: the largest lazy chunk here is a few KB, so this is a tripwire for an
 * order-of-magnitude change, not a budget anyone has to keep shaving.
 */
const LAZY_MAX_GZIP = 50 * 1024;

for (const name of lazy) {
  const size = gzipSync(readFileSync(join(assets, name))).length;
  if (size > LAZY_MAX_GZIP) {
    fail(`lazy chunk ${name} is ${kb(size)} gzipped, over the ${kb(LAZY_MAX_GZIP)} ceiling`);
  } else {
    console.log(`  lazy  ${name}: ${kb(size)} gzipped (ceiling ${kb(LAZY_MAX_GZIP)})`);
  }
}

process.exit(failed ? 1 : 0);

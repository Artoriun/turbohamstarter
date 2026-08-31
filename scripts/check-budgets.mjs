#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
/**
 * Two build-time guards, run from CI's `verify` job.
 *
 * 1. Image URLs must go through optimizeUrl()/fullBleedSrcSet(). This is the guard that
 *    catches a full-resolution original being served to a phone: nothing errors, the
 *    image simply arrives slowly, so it is invisible without a check like this.
 *
 * 2. Bundle budgets on the gzipped output, which is what actually crosses the wire.
 *    Deliberately close to current size so growth surfaces as a failure to think about
 *    rather than a number nobody reads.
 */
import { gzipSync } from 'node:zlib';

// Which frontend to check — 'web' (React, the default, unchanged from before this was
// parameterized) or 'web-vue'.
const TARGET = process.env.TARGET ?? 'web';
const WEB = new URL(`../packages/${TARGET}/`, import.meta.url).pathname;
// Detected from the package's own dependencies rather than assumed from TARGET: in this
// monorepo 'web' always means React, but a published single-frontend repo (see
// scripts/publish-target.mjs) renames whichever frontend it ships to packages/web — so a
// published Vue repo has Vue source living at the 'web' target. Branching on the literal
// string would silently scan for .tsx files that don't exist there and pass a check that
// never actually looked at anything.
const isVue =
  'vue' in (JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')).dependencies ?? {});
// `.js`/`.css` mark which extensions count toward the payload; `initial` is the budget
// that actually gates. Set it a little above where you currently are, so growth surfaces
// as a failure to think about rather than a number nobody reads.
//
// React (~107KB): two things dominate. Motion is ~27KB of it, already reduced from ~40KB
// by LazyMotion + the `m` components (see main.tsx) — strip the animations and you get
// that back. The bundled content in packages/shared is imported as a value, not a type, so
// it lands in the entry chunk: deliberate, because it is what lets the site render with
// the API asleep, and it means this budget grows with your content — most recently the
// home carousel's three placeholder projects (bilingual heading + body each). Their
// illustrations do not count here: they live in public/ as plain files rather than
// imports, specifically so they cost a request instead of JS-budget bytes — see the note
// in packages/web/src/lib/projectAssets.ts.
//
// Vue (~61KB): no animation library (the carousel and page transitions are plain CSS —
// see ProjectCarousel.vue/PageTransition.vue), and vue-router is smaller than
// react-router-dom, so the same shared content costs noticeably less here.
/**
 * Headroom is part of the budget, not slack in it.
 *
 * These were 112 and 68 against actual payloads of 111.96 and 67.46 — 0.04KB and 0.54KB of
 * room. At that margin the check does not distinguish a regression from any change at all:
 * adding two error messages and a console warning to the content loader (0.18KB gzipped,
 * measured) turned it red. A tripwire that fires on every commit gets its number nudged up
 * each time, which is the same as not having one.
 *
 * Set roughly 3% above the current payload — enough that ordinary work does not trip it, far
 * too little to absorb an accidental library import, which is the thing worth catching.
 * Lower them again if either payload drops substantially; the point is proximity, not the
 * number.
 */
const BUDGET_GZIP = {
  '.js': true,
  '.css': true,
  initial: (isVue ? 70 : 116) * 1024,
};

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

// ---- 1. untransformed image URLs --------------------------------------------
const SAFE = /optimizeUrl\(|fullBleedSrcSet\(/;
// JSX writes a bound src as `src={...}`; a Vue template writes it `:src="..."`. Either way
// `.src =` covers the imperative case (new Image().src = ... for preloading).
const SRC_ATTR = isVue ? /(:src="|:srcset="|\.src\s*=)/ : /(\bsrc=\{|srcSet=\{|\.src\s*=)/;
const SOURCE_EXT = isVue ? ['.ts', '.vue'] : ['.ts', '.tsx'];
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p);
    return SOURCE_EXT.includes(extname(e.name)) ? [p] : [];
  });

let scanned = 0;
for (const file of walk(join(WEB, 'src'))) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      // an image URL flowing into a <img src>, a srcSet, or Image().src
      if (!SRC_ATTR.test(line)) return;
      if (!/\.image\b/.test(line)) return;
      scanned++;
      if (!SAFE.test(line)) {
        fail(
          `${file.replace(WEB, `packages/${TARGET}/`)}:${i + 1} uses an image URL without optimizeUrl(): ${line.trim()}`,
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
/**
 * The entry files index.html actually references, not every `index-*` in the directory.
 *
 * Reading the directory measured stale builds too: turbo restores `dist/**` from its cache,
 * so hashes from earlier builds accumulate beside the current ones and the budget summed two
 * complete entry sets — 224KB against a 116KB budget, on a build that was well inside it. CI
 * never saw this because a fresh checkout has no cache to restore; it made the check unusable
 * locally, which is exactly where it should be most useful.
 *
 * It is also the more honest measurement: the budget is a claim about what a visitor
 * downloads, and what a visitor downloads is what the document asks for.
 */
const html = readFileSync(join(WEB, 'dist/index.html'), 'utf8');
const entry = [
  ...new Set([...html.matchAll(/assets\/(index-[\w-]+\.(?:js|css))/g)].map((m) => m[1])),
];
if (entry.length === 0) {
  console.error('✗ no entry assets referenced by dist/index.html — was the build run?');
  process.exit(1);
}
// Same staleness problem as the entry files, one step removed: a lazy chunk is referenced
// from the entry bundle rather than the document, so that is where to look. A leftover chunk
// from an earlier build is referenced by nobody and is not part of this build's payload.
const entryJs = entry
  .filter((n) => extname(n) === '.js')
  .map((n) => readFileSync(join(assets, n), 'utf8'))
  .join('');
const lazy = readdirSync(assets).filter(
  (n) => !n.startsWith('index-') && BUDGET_GZIP[extname(n)] && entryJs.includes(n),
);

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
 * A ceiling on any single lazy chunk, so one growing large is a decision somebody makes
 * rather than something nobody sees. These were printed and explicitly "not budgeted", which
 * is fine right up until a route quietly pulls in a viewer or a chart library — a sibling
 * project shipped 1.54MB of PDF viewer behind a modal that way, and nothing said a word.
 *
 * Deliberately loose: the largest here is a few KB, so this is a tripwire for an
 * order-of-magnitude change, not a budget anyone should have to keep shaving.
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

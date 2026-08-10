#!/usr/bin/env node
/**
 * Writes the live poems to a timestamped JSON file.
 *
 *   npm run backup-poems            # -> backups/poems-YYYY-MM-DD.json
 *   npm run backup-poems -- --check # compare against the bundle, write nothing
 *
 * The poems visitors see are Firestore overrides merged over the hardcoded fallback in
 * packages/shared/src/index.ts. That fallback drifts the moment anything is edited in the
 * admin portal, so losing the Firestore project would silently roll the site back to older
 * text — no error, just the wrong poems. This keeps a copy of the merged result, which is
 * what would actually need restoring.
 *
 * CI runs it on the weekly rebuild and keeps the file as a build artifact, so the backup
 * happens without a repo-write token.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { POEMS } from '@gedichtenv2/shared';

const api = (process.env.VITE_API_URL ?? '').replace(/^http:\/\//, 'https://');
const check = process.argv.includes('--check');
const outDir = new URL('../backups/', import.meta.url).pathname;

if (!api) {
  console.error('✗ VITE_API_URL is not set — nothing to back up from');
  process.exit(1);
}

const res = await fetch(`${api}/api/poems`, { signal: AbortSignal.timeout(30_000) });
if (!res.ok) {
  console.error(`✗ API returned ${res.status}`);
  process.exit(1);
}
const live = await res.json();
if (!Array.isArray(live) || live.length === 0) {
  console.error('✗ API returned no poems; refusing to write an empty backup');
  process.exit(1);
}

// Ignore differences that cannot change what a reader sees, so --check reports drift that
// actually matters rather than the API's habit of returning empty arrays for absent fields.
const norm = (p) =>
  JSON.stringify({
    id: p.id,
    title: p.title,
    image: p.image,
    overlay: p.overlay,
    featured: p.featured || undefined,
    customSlides: p.customSlides?.length ? p.customSlides : undefined,
    customSlidesEnabled: p.customSlidesEnabled || undefined,
  });

const bundled = POEMS.filter((p) => !p.deleted);
const byId = new Map(bundled.map((p) => [p.id, p]));
const drifted = live.filter((p) => {
  const b = byId.get(p.id);
  return !b || norm(p) !== norm(b);
});
const orderChanged = live.map((p) => p.id).join() !== bundled.map((p) => p.id).join();

console.log(`  live: ${live.length} poems, bundled fallback: ${bundled.length}`);
console.log(`  drifted from the fallback: ${drifted.length}${orderChanged ? ' (+ order)' : ''}`);
if (drifted.length) console.log(`  ${drifted.map((p) => p.id).join(', ')}`);

if (check) {
  // Informational only. Drift is expected and fine — the point is that it is visible.
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const file = `${outDir}poems-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, `${JSON.stringify(live, null, 2)}\n`);
console.log(`✓ wrote ${file.replace(/.*\/backups\//, 'backups/')}`);

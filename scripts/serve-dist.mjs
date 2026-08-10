#!/usr/bin/env node
/**
 * Serves packages/web/dist the way GitHub Pages does — see scripts/lib/static-server.mjs.
 *
 * Used as Playwright's webServer when E2E_TARGET=dist, so the suite can run against the
 * built, prerendered output instead of the dev server. That is not a cosmetic difference:
 * the dev server has no prerendered HTML, no base path and no 404.html, so no test running
 * against it can see a hydration mismatch, a link that escapes the base, or a route that
 * only works because Pages falls back.
 *
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer, listen } from './lib/static-server.mjs';

const DIST = fileURLToPath(new URL('../packages/web/dist/', import.meta.url));
// Matches vite.config.ts and prerender.mjs, which both hardcode it for the same reason: a
// second mechanism here would just be one more place for the three to quietly disagree.
const BASE = '/kov-cs-poetry/';
const port = Number(process.argv[2] ?? process.env.WEB_PORT ?? 3260);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ nothing built to serve — run `npm run build && npm run prerender` first');
  process.exit(1);
}

// A dist built for the wrong base would 404 on every asset and fail every test with something
// far less obvious than this line.
if (!readFileSync(join(DIST, 'index.html'), 'utf8').includes(`"${BASE}assets/`)) {
  console.error(`✗ dist was not built for ${BASE} — run \`npm run build\` (it sets NODE_ENV)`);
  process.exit(1);
}

if (!existsSync(join(DIST, '404.html'))) {
  console.error('✗ dist has no 404.html — run `npm run prerender`');
  process.exit(1);
}

const server = createStaticServer({ dist: DIST, basePath: BASE });
await listen(server, port);
console.log(`serving ${DIST} at http://localhost:${port}${BASE}`);

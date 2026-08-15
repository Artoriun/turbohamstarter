#!/usr/bin/env node
/**
 * Serves a built frontend the way GitHub Pages does — see scripts/lib/static-server.mjs.
 *
 * Used as Playwright's webServer when E2E_TARGET=dist, so the suite can run against the
 * built, prerendered output at its real base path instead of the dev server at the domain
 * root. The dev server has no prerendered HTML, no base path and no 404.html, so a link that
 * escapes the site, a route that only works because Pages falls back, or markup that never
 * carries content all pass a green suite.
 *
 * Usage: node scripts/serve-dist.mjs [port]   (TARGET and BASE_PATH as elsewhere)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer, listen } from './lib/static-server.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TARGET = process.env.TARGET ?? 'web';
const DIST = join(ROOT, `packages/${TARGET}/dist`);
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
// A distinct port from the dev server's, so the two can run side by side. See the port block
// documented in README.md — nothing here shares a number with the 3000/4000 ranges other
// projects habitually use.
const port = Number(
  process.argv[2] ?? process.env.DIST_PORT ?? (TARGET === 'web-vue' ? 3731 : 3730),
);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`✗ nothing built to serve in ${DIST} — build and prerender first`);
  process.exit(1);
}

// A dist built for a different base than the one being served would 404 on every asset and
// fail every test with something far less obvious than this line.
if (BASE !== '/' && !readFileSync(join(DIST, 'index.html'), 'utf8').includes(`"${BASE}assets/`)) {
  console.error(`✗ dist was not built for ${BASE} — rebuild with BASE_PATH=${BASE}`);
  process.exit(1);
}

if (!existsSync(join(DIST, '404.html'))) {
  console.error('✗ dist has no 404.html — run the prerender step');
  process.exit(1);
}

const server = createStaticServer({ dist: DIST, basePath: BASE });
await listen(server, port);
console.log(`serving ${DIST} at http://localhost:${port}${BASE}`);

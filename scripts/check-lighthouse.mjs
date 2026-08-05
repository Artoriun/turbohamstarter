#!/usr/bin/env node
/**
 * Runs Lighthouse against the built, prerendered output and fails the build on a
 * regression.
 *
 * Only accessibility, SEO and best-practices are gated. Those three are deterministic —
 * they inspect the markup, not the clock — so a threshold on them means what it says.
 * Performance is measured and printed but never gated: a shared CI runner's timings vary
 * by more than the thing being measured, and a gate that fails randomly gets disabled
 * within a fortnight. The bundle budget in check-budgets.mjs is the deterministic half of
 * performance, and that one does gate.
 *
 * Serves the output itself rather than assuming a server is up, mounted at BASE_PATH so
 * the audit sees the same URLs GitHub Pages will.
 */
import { execFile } from 'node:child_process';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { chromium } from '@playwright/test';

/**
 * Not execFileSync: that blocks the whole event loop until the child exits, but the child
 * is Lighthouse's own Chrome, which needs to fetch pages from the http.createServer below —
 * running in this very process. Blocked event loop, unservable request, Lighthouse eventually
 * gives up and reports "Target closed" once its own timeouts expire. Awaiting an async child
 * keeps the server responsive while Lighthouse runs.
 */
function runLighthouse(args, env) {
  return new Promise((resolve, reject) => {
    const child = execFile('npx', args, { env }, (err) => (err ? reject(err) : resolve()));
    child.stderr?.pipe(process.stderr);
  });
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Which frontend to audit — 'web' (React, the default, unchanged from before this was
// parameterized) or 'web-vue'.
const TARGET = process.env.TARGET ?? 'web';
const DIST = join(ROOT, `packages/${TARGET}/dist`);
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
// Distinct default per target — see the matching comment in prerender.mjs. This script
// already refuses to bind onto a port that's still in use rather than silently auditing the
// wrong server, but the monorepo's own ci.yml runs both targets' audits back-to-back in the
// same job, and a shared default made that a real (if loud) flake risk.
const PORT = Number(process.env.LH_PORT ?? (TARGET === 'web-vue' ? 4600 : 4599));
const CHROME_PATH = chromium.executablePath();

/** Audited on every run: the landing page, plus one route that is only reachable as a
 *  prerendered file — so a broken prerender shows up here as well. */
const ROUTES = ['', 'about/'];

const THRESHOLDS = { accessibility: 100, seo: 100, 'best-practices': 100 };

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ no build to audit — run `npm run build && npm run prerender` first');
  process.exit(1);
}

// GitHub Pages gzips every text response; this server didn't, so the performance number
// (unlike the three gated categories, which only inspect markup) was measuring an asset
// transfer no visitor actually gets — worth a couple of seconds of LCP under Lighthouse's
// simulated mobile throttle. Binary types are already compressed, so left alone.
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.xml', '.txt']);

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(BASE)) {
    res.writeHead(404).end('not found');
    return;
  }
  path = path.slice(BASE.length);
  // normalize collapses any ../ before it can escape DIST.
  let file = join(DIST, normalize(`/${path}`));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    // Same fallback GitHub Pages uses, so an unexpected 404 in the audit is a real one.
    res.writeHead(404, { 'Content-Type': 'text/html' });
    createReadStream(join(DIST, '404.html')).pipe(res);
    return;
  }
  const gzip =
    COMPRESSIBLE.has(extname(file)) && (req.headers['accept-encoding'] ?? '').includes('gzip');
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    // Pages serves hashed assets with a real lifetime; without this the audit reports a
    // caching problem that only exists in this script.
    'Cache-Control': 'public, max-age=600',
    ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
  });
  const stream = createReadStream(file);
  if (gzip) stream.pipe(createGzip()).pipe(res);
  else stream.pipe(res);
});

// Refuse to audit whatever else happens to be on this port. Silently auditing the wrong
// server produces a plausible-looking report, which is worse than not running at all.
await new Promise((resolve, reject) => {
  server.once('error', (err) =>
    reject(
      err.code === 'EADDRINUSE'
        ? new Error(`port ${PORT} is already in use — free it, or set LH_PORT`)
        : err,
    ),
  );
  server.listen(PORT, resolve);
}).catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});

let failed = false;
try {
  for (const route of ROUTES) {
    const url = `http://localhost:${PORT}${BASE}${route}`;
    const suffix = TARGET === 'web' ? '' : `-${TARGET}`;
    const out = join(ROOT, `lighthouse-${route.replace(/\W/g, '') || 'home'}${suffix}.json`);

    await runLighthouse(
      [
        'lighthouse',
        url,
        '--only-categories=performance,accessibility,best-practices,seo',
        '--form-factor=mobile',
        '--screenEmulation.mobile',
        '--output=json',
        `--output-path=${out}`,
        '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
        '--quiet',
      ],
      // Lighthouse's own Chrome launcher picks whatever it finds installed, which is a
      // second browser to provision and a different build from the one the layout tests
      // run against. Playwright's Chromium is already a dependency and already installed
      // in CI, so point Lighthouse at that.
      { ...process.env, CHROME_PATH },
    );

    const report = JSON.parse(readFileSync(out, 'utf8'));
    const score = (id) => Math.round((report.categories[id].score ?? 0) * 100);

    console.log(`\n  ${url}`);
    console.log(
      `    performance ${score('performance')}  (not gated)  ` +
        `LCP ${report.audits['largest-contentful-paint'].displayValue}  ` +
        `CLS ${report.audits['cumulative-layout-shift'].displayValue}`,
    );

    for (const [id, min] of Object.entries(THRESHOLDS)) {
      const actual = score(id);
      const ok = actual >= min;
      console.log(`    ${ok ? '✓' : '✗'} ${id} ${actual} (min ${min})`);
      if (ok) continue;
      failed = true;
      // Without the specific audits this is just a number, and the first thing anyone
      // reading a red build does is re-run it locally to find out which one moved.
      for (const ref of report.categories[id].auditRefs) {
        const audit = report.audits[ref.id];
        if (audit.score === null || audit.score >= 1) continue;
        console.log(`        ${ref.id}: ${audit.title}`);
        for (const item of (audit.details?.items ?? []).slice(0, 5)) {
          const where = item.node?.selector ?? item.url ?? item.text ?? item.description;
          if (where) console.log(`          ${String(where).slice(0, 110)}`);
        }
      }
    }
  }
} finally {
  server.close();
}

process.exit(failed ? 1 : 0);

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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createStaticServer, listen } from './lib/static-server.mjs';

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
const PORT = Number(process.env.LH_PORT ?? (TARGET === 'web-vue' ? 3741 : 3740));
const CHROME_PATH = chromium.executablePath();

/** Audited on every run: the landing page, plus one route that is only reachable as a
 *  prerendered file — so a broken prerender shows up here as well. */
const ROUTES = ['', 'about/'];

const THRESHOLDS = { accessibility: 100, seo: 100, 'best-practices': 100 };

// Gated where performance is not, and the distinction is not arbitrary: performance is
// dominated by wall-clock timings that drift with whatever else a shared runner is doing,
// whereas CLS measures how far the layout moved — a property of the markup and CSS rather
// than of the machine. 0.05 leaves room for noise while still failing on a real shift.
const MAX_CLS = 0.05;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ no build to audit — run `npm run build && npm run prerender` first');
  process.exit(1);
}

// Shared with the Playwright run against the built output — see scripts/lib/static-server.mjs.
const server = createStaticServer({ dist: DIST, basePath: BASE });

await listen(server, PORT);

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

    const cls = report.audits['cumulative-layout-shift'].numericValue ?? 0;
    const clsOk = cls <= MAX_CLS;
    console.log(`    ${clsOk ? '✓' : '✗'} CLS ${cls.toFixed(3)} (max ${MAX_CLS})`);
    if (!clsOk) {
      failed = true;
      for (const item of (report.audits['layout-shifts']?.details?.items ?? []).slice(0, 5)) {
        const where = item.node?.selector ?? item.url ?? item.description;
        if (where) console.log(`        ${String(where).slice(0, 110)}`);
      }
    }

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

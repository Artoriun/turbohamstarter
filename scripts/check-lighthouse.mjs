#!/usr/bin/env node
/**
 * Runs Lighthouse against the built, prerendered output and fails the build on a
 * regression.
 *
 * Only accessibility, SEO, best-practices and CLS are gated. Those are deterministic —
 * they inspect the markup, not the clock — so a threshold on them means what it says.
 * Performance is measured and printed but never gated: a shared CI runner's timings vary
 * by more than the thing being measured, and a gate that fails randomly gets disabled
 * within a fortnight. The bundle budget in check-budgets.mjs is the deterministic half of
 * performance, and that one does gate.
 *
 * Serves the output itself rather than assuming a server is up, mounted at the site's
 * GitHub Pages base so the audit sees the same URLs Pages will.
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
const DIST = join(ROOT, 'packages/web/dist');
// Not an env var: nothing else in this repo parametrises the base path either (vite.config.ts
// and prerender.mjs both hardcode /kov-cs-poetry/), so a second mechanism here would just be
// one more place for the two to quietly disagree.
const BASE = '/kov-cs-poetry/';
const PORT = Number(process.env.LH_PORT ?? 4599);
const CHROME_PATH = chromium.executablePath();

/** The landing page, plus the poems index — a route that only exists as a prerendered
 *  file, so a broken prerender shows up here as well. Not any individual /poems/:id: those
 *  come and go as poems are added or edited, and this list should stay stable. */
const ROUTES = ['', 'poems/'];

const THRESHOLDS = { accessibility: 100, seo: 100, 'best-practices': 100 };

/**
 * CLS is gated even though performance as a whole is not, because it measures layout rather
 * than the clock: it does not drift with a shared runner's timing the way LCP does, so a
 * threshold on it means what it says. 0.05 is well inside Google's 0.1 "good" band and well
 * above the 0 this site currently scores.
 */
const MAX_CLS = 0.05;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ no build to audit — run `npm run build && npm run prerender` first');
  process.exit(1);
}

const server = createStaticServer({ dist: DIST, basePath: BASE });
// Refuses to audit whatever else happens to be on this port — see listen().
await listen(server, PORT).catch((err) => {
  console.error(`✗ ${err.message} (set LH_PORT)`);
  process.exit(1);
});

let failed = false;
try {
  for (const route of ROUTES) {
    const url = `http://localhost:${PORT}${BASE}${route}`;
    const out = join(ROOT, `lighthouse-${route.replace(/\W/g, '') || 'home'}.json`);

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
        `CLS ${report.audits['cumulative-layout-shift'].displayValue} (max ${MAX_CLS})`,
    );

    const cls = report.audits['cumulative-layout-shift'].numericValue ?? 0;
    if (cls > MAX_CLS) {
      console.log(`    ✗ cumulative-layout-shift ${cls.toFixed(3)} (max ${MAX_CLS})`);
      failed = true;
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

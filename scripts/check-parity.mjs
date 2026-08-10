#!/usr/bin/env node
/**
 * Fails if the prerendered first paint disagrees with the hydrated page.
 *
 * The prerenderer already refuses to publish on a hydration *error* (React 418/423/425). This
 * catches the other case: a hydration that succeeds and still moves. React silently patches
 * mismatched styles, so a page can hydrate "cleanly" while the visitor watches the heading
 * jump — which is what happened in a sibling repo, where a JS-measured breakpoint painted a
 * desktop heading and snapped to the mobile one. It cost 0.033 CLS and no test saw it.
 *
 * Deliberately narrow: each route's <h1> typography and box, at a phone viewport, with
 * JavaScript disabled (what actually paints first) against fully hydrated. A whole-page diff
 * would trip over the reader's pagination, which legitimately differs — the prerenderer emits
 * the entire poem and the client then splits it to fit.
 *
 * A separate script rather than a step inside prerender.mjs, for two reasons: it runs against
 * an existing dist in seconds instead of adding a browser pass to a three-minute build, and a
 * gate that cannot be run on its own cannot be watched to fail, which is the only thing that
 * makes it worth having.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createStaticServer, listen } from './lib/static-server.mjs';

const DIST = fileURLToPath(new URL('../packages/web/dist/', import.meta.url));
const BASE = '/kov-cs-poetry/';
const PORT = Number(process.env.PARITY_PORT ?? 4611);
const VIEWPORT = { width: 412, height: 915 };

// One route per distinct layout, not all 38: the poem routes share a component and a
// stylesheet, so poem 2 can only fail in a way poem 1 already has.
const ROUTES = ['', 'poems/', 'poems/poem-1', 'contact'];

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ no build to check — run `npm run build && npm run prerender` first');
  process.exit(1);
}

const server = createStaticServer({ dist: DIST, basePath: BASE });
await listen(server, PORT).catch((err) => {
  console.error(`✗ ${err.message} (set PARITY_PORT)`);
  process.exit(1);
});

const browser = await chromium.launch();

async function measureH1(url, javaScriptEnabled) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, javaScriptEnabled });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  if (javaScriptEnabled) await page.waitForTimeout(500); // let hydration commit
  const measured = await page
    .locator('h1')
    .first()
    .evaluate(
      (el) => {
        const cs = getComputedStyle(el);
        return {
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          width: Math.round(el.getBoundingClientRect().width),
        };
      },
      { timeout: 5000 },
    )
    .catch(() => null);
  await ctx.close();
  return measured;
}

let failures = 0;
for (const route of ROUTES) {
  const url = `http://localhost:${PORT}${BASE}${route}`;
  const [first, hydrated] = await Promise.all([measureH1(url, false), measureH1(url, true)]);
  if (!first || !hydrated) {
    console.error(`✗ /${route} has no <h1> to compare — the route or the selector has changed`);
    failures++;
    continue;
  }
  const diffs = ['fontSize', 'fontWeight', 'width'].filter((k) => first[k] !== hydrated[k]);
  if (diffs.length) {
    for (const k of diffs) {
      console.error(`✗ /${route} h1 ${k}: first paint ${first[k]} → hydrated ${hydrated[k]}`);
    }
    failures++;
  } else {
    console.log(`✓ /${route} h1 identical before and after hydration (${first.fontSize})`);
  }
}

await browser.close();
server.close();
process.exit(failures ? 1 : 0);

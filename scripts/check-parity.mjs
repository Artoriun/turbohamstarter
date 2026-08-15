#!/usr/bin/env node
/**
 * Fails if the prerendered first paint disagrees with the hydrated page.
 *
 * prerender.mjs already refuses to publish on a hydration *error*. This catches the other
 * case: a hydration that succeeds and still moves. The framework silently patches mismatched
 * styles, so a page can hydrate "cleanly" while the visitor watches the heading jump — a
 * JS-measured breakpoint painting a desktop heading and snapping to the mobile one costs real
 * CLS and throws nothing.
 *
 * Deliberately narrow: each route's <h1> typography and box, at a phone viewport, with
 * JavaScript disabled (what actually paints first) against fully hydrated. A whole-page diff
 * would trip over anything that legitimately differs after hydration.
 *
 * Runs against an existing dist in seconds rather than as a step inside prerender.mjs. A gate
 * that cannot be run on its own cannot be watched to fail, and a gate nobody has watched fail
 * is not evidence of anything.
 *
 * Usage: npm run check:parity  /  TARGET=web-vue npm run check:parity
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createStaticServer, listen } from './lib/static-server.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TARGET = process.env.TARGET ?? 'web';
const DIST = join(ROOT, `packages/${TARGET}/dist`);
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
// Distinct per target so the two can run side by side, matching check-lighthouse.mjs.
const PORT = Number(process.env.PARITY_PORT ?? (TARGET === 'web-vue' ? 3751 : 3750));
const VIEWPORT = { width: 412, height: 915 };

// One route per distinct layout, not every prerendered page: the localised variants share a
// component and a stylesheet, so /nl can only fail in a way / already has.
const ROUTES = ['', 'about', 'contact'];

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`✗ no build to check in ${DIST} — run the build and prerender first`);
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

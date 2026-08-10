import { expect, test } from './fixtures';

/**
 * The site as GitHub Pages actually serves it: built, prerendered, and mounted under
 * /kov-cs-poetry/ (`E2E_TARGET=dist`, see playwright.config.ts).
 *
 * Everything here is invisible to the default target. The dev server has no prerendered HTML,
 * no base path and no 404.html, so a link that resolves outside the site, a route that only
 * works because Pages falls back, or markup that never hydrates all pass a green suite.
 *
 * Only this file runs against dist (see the `test:e2e:dist` script). The rest of the suite
 * targets the dev server, where the API and images are stubbed and layout is deterministic;
 * pointed at dist it fails for reasons that have nothing to do with the build.
 *
 * **Paths below are relative on purpose.** `baseURL` already carries the base path, and a
 * leading slash discards it — which is both the mistake being tested for and the reason a
 * sibling repo's dist run had to be abandoned: `page.goto('/about')` silently navigated
 * outside the app's basename and every assertion failed for the wrong reason.
 */

const BASE_PATH = '/kov-cs-poetry/';

test.skip(process.env.E2E_TARGET !== 'dist', 'only meaningful against the built output');

test('the home page boots under the base path', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carousel-slide').first()).toBeVisible();
});

test('the poems grid boots under the base path', async ({ page }) => {
  await page.goto('./poems');
  await expect(page.locator('a[href*="/poems/"]').first()).toBeVisible();
});

test('the admin sign-in boots, which means the SPA fallback works', async ({ page }) => {
  // /admin is the one route never prerendered, so Pages answers it with 404.html. If that
  // file were a prerendered page rather than the plain build shell, the client would try to
  // hydrate the wrong route into it and React would discard the markup — this asserts the
  // fallback both exists and is the right file.
  await page.goto('./admin');
  await expect(page.locator('#admin-password')).toBeVisible();
});

test('a poem is readable with JavaScript disabled', async ({ browser }) => {
  // The whole point of prerendering: a crawler with no JS still gets the poem. This is the
  // only test in the suite that proves the prerendered HTML carries content rather than an
  // empty #root waiting to be hydrated.
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3260${BASE_PATH}poems/poem-1`);
  await expect(p.locator('h1')).toBeVisible();
  // textContent, not innerText: the reveal animation starts the lines at opacity 0 and a
  // class added by JS brings them in, so innerText is empty here by design. What prerendering
  // has to guarantee is that the words are in the markup — which is what a crawler reads, and
  // what the prerenderer's own self-check asserts.
  const text = await p.locator('.detail-overlay').first().textContent();
  expect((text ?? '').trim().length).toBeGreaterThan(0);
  await ctx.close();
});

test('no link or asset escapes the base path', async ({ page }) => {
  const escapes: string[] = [];

  for (const path of ['./', './poems', './poems/poem-1', './contact']) {
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');

    escapes.push(
      ...(await page.evaluate((base) => {
        const bad: string[] = [];
        const check = (value: string | null, what: string) => {
          // Only root-absolute values can escape; relative ones resolve against the current
          // directory and protocol-absolute ones are deliberate off-site links.
          if (!value?.startsWith('/')) return;
          // `/kov-cs-poetry` without the trailing slash is the site root, not an escape —
          // the header's home link renders exactly that.
          if (value === base.slice(0, -1)) return;
          if (!value.startsWith(base)) bad.push(`${what}: ${value}`);
        };
        for (const a of document.querySelectorAll('a[href]')) {
          check(a.getAttribute('href'), 'link');
        }
        for (const el of document.querySelectorAll('script[src], link[href], img[src]')) {
          check(el.getAttribute('src') || el.getAttribute('href'), el.tagName.toLowerCase());
        }
        return bad;
      }, BASE_PATH)),
    );
  }

  expect(escapes, `these resolve outside ${BASE_PATH}`).toEqual([]);
});

import { expect, test } from '@playwright/test';

/**
 * The site as GitHub Pages actually serves it: built, prerendered, and mounted under
 * BASE_PATH (`E2E_TARGET=dist`, see playwright.config.ts).
 *
 * Only this file runs against dist. The rest of the suite targets the dev server, where the
 * API and images are stubbed and layout is deterministic; pointed at dist it would fail for
 * reasons that say nothing about the build.
 *
 * **Paths below are relative on purpose.** `baseURL` already carries the base path, and a
 * leading slash discards it. That is not a hypothetical: an earlier attempt at this run was
 * abandoned precisely because `page.goto('/about')` navigated outside the router's basename
 * and every assertion failed for the wrong reason.
 *
 * It also imports `test` from Playwright directly rather than from ./fixtures: those fixtures
 * stub the API and images for the dev server, and here the point is to exercise what was
 * actually built.
 */

const BASE_PATH = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

test.skip(process.env.E2E_TARGET !== 'dist', 'only meaningful against the built output');

test('the home page boots under the base path', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('h1').first()).toBeVisible();
});

test('an inner route boots under the base path', async ({ page }) => {
  await page.goto('./about');
  await expect(page.locator('h1').first()).toBeVisible();
});

test('the non-default language boots, basename prefix and all', async ({ page }) => {
  // The basename is BASE_PATH *plus* a language segment, so this is the one route where two
  // independent prefixes have to compose correctly. Getting it wrong leaves the router
  // matching nothing and rendering the not-found page under a 200.
  await page.goto('./ja/about');
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
});

test('an unknown path falls back to the build shell, not a prerendered page', async ({ page }) => {
  // Pages answers anything unmatched with 404.html. It must be the untouched shell: if it
  // were a copy of a prerendered page, the client would try to hydrate that page's markup
  // into whatever the router actually matched, and throw the markup away.
  const res = await page.goto('./no-such-page');
  expect(res?.status()).toBe(404);
  // Status and a mount point are not enough — a prerendered page copied here has both. What
  // distinguishes the shell is that its mount point is *empty* before any script runs, so
  // this reads the raw HTML rather than the live DOM the client has already rendered into.
  const html = await res?.text();
  const root = (html ?? '').match(/<div id="(?:root|app)"[^>]*>([\s\S]*?)<\/div>/);
  expect(root, 'the fallback should contain a mount point').not.toBeNull();
  expect(
    (root?.[1] ?? '').trim(),
    'the fallback must be the plain build shell, not a copy of a prerendered page',
  ).toBe('');
});

test('a prerendered page carries its content without JavaScript', async ({ browser }) => {
  // The whole point of prerendering: a crawler with no JS still gets the text.
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  const port = process.env.DIST_PORT ?? (process.env.TARGET === 'web-vue' ? '3731' : '3730');
  await p.goto(`http://localhost:${port}${BASE_PATH}about`);
  // The heading specifically, not body text: textContent includes the contents of inline
  // <script> tags, so an entirely empty page still measures in the thousands of characters
  // and this assertion passed against markup with nothing rendered in it at all.
  const heading = await p.locator('h1').first().textContent();
  expect(
    (heading ?? '').trim().length,
    'the prerendered page should carry its heading',
  ).toBeGreaterThan(0);
  await ctx.close();
});

test('no link or asset escapes the base path', async ({ page }) => {
  const escapes: string[] = [];

  for (const path of ['./', './about', './contact', './ja/about']) {
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');

    escapes.push(
      ...(await page.evaluate((base) => {
        const bad: string[] = [];
        const check = (value: string | null, what: string) => {
          // Only root-absolute values can escape; relative ones resolve against the current
          // directory and protocol-absolute ones are deliberate off-site links.
          if (!value?.startsWith('/')) return;
          // The base without its trailing slash is the site root, not an escape.
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

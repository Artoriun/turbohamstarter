import { ROUTES, SECTIONS } from '@hamstarter/shared';
import { test as base, expect } from '@playwright/test';

// 1x1 transparent PNG. Images are sized entirely by CSS, so a stub lays out identically
// while removing every CDN round-trip.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// `void` is Playwright's own type for a fixture that provides no value, which is what an
// auto fixture like this one is.
// biome-ignore lint/suspicious/noConfusingVoidType: idiomatic for a valueless Playwright fixture
export const test = base.extend<{ failOnPageError: void }>({
  // An uncaught error on the page fails the test that caused it. Cheap, and nothing was
  // watching: in the sibling Qalor site a handler read `e.currentTarget` inside a setTimeout
  // — which React has already cleared by then — so every press threw a TypeError while the
  // whole suite stayed green. Worth knowing that this only sees code some test actually
  // reaches; there, no test pressed the element in question, so the throw went unnoticed
  // until it was found by hand on a phone.
  failOnPageError: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use();
      expect(errors, 'uncaught error(s) on the page').toEqual([]);
    },
    { auto: true },
  ],

  page: async ({ page }, use) => {
    // Serve the bundled content rather than hitting a real API: keeps the suite
    // deterministic and off a free-tier instance that sleeps.
    await page.route('**/api/content', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SECTIONS),
      }),
    );
    // Network variance is the enemy of geometric assertions: a late image or webfont
    // changes text metrics and therefore line wrapping.
    await page.route('**res.cloudinary.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
    );
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * Every route a visitor can reach. /admin is excluded: it is behind a password.
 *
 * Re-exported from the same list the prerenderer uses rather than copied, so adding a page
 * cannot leave it prerendered but untested — which is exactly the gap a hand-kept second
 * copy opens the first time someone adds a route in a hurry.
 */
export const PAGES = ROUTES;

import { ROUTES, SECTIONS } from '@hamstarter/shared';
import { test as base } from '@playwright/test';

// 1x1 transparent PNG. Images are sized entirely by CSS, so a stub lays out identically
// while removing every CDN round-trip.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const test = base.extend({
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

import { POEMS } from '@gedichtenv2/shared';
import { test as base, expect } from '@playwright/test';

// 1x1 transparent PNG — the poem images are sized entirely by CSS (object-fit: cover), so
// a stub lays out identically while removing every Cloudinary round-trip.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * `failOnPageError` fails a test if the page threw an uncaught error, even when every
 * assertion passed.
 *
 * Added because that gap shipped a real bug in a sibling repo: five handlers read
 * `e.currentTarget` inside a `setTimeout`, which React has already cleared by then, so every
 * tap on the logo threw `Cannot read properties of null` and left the element stuck
 * mid-animation. The whole suite stayed green — nothing was watching the console. A thrown
 * error is about the cheapest signal a browser gives that something is wrong, and it was
 * going straight to the floor.
 *
 * `auto: true` so every spec importing `test` from here gets it, with no per-test opt-in to
 * forget.
 */
// `void` is Playwright's own type for a fixture that provides no value, which is what an
// auto fixture like this one is.
// biome-ignore lint/suspicious/noConfusingVoidType: idiomatic for a valueless Playwright fixture
export const test = base.extend<{ failOnPageError: void }>({
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
    // The app has no offline fallback — a failed fetch renders nothing — so serve the
    // shared fixtures. Also keeps the suite off the Render instance, which sleeps.
    await page.route('**/api/poems', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(POEMS) }),
    );
    // Network variance is the enemy of geometric assertions: image loads gate the reveal,
    // and a late webfont changes text metrics and therefore line wrapping.
    await page.route('**res.cloudinary.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
    );
    await use(page);
  },
});

export { expect } from '@playwright/test';

/** A poem whose slides are hand-authored, so it takes the custom-slide layout path. */
export const CUSTOM_SLIDE_POEM =
  POEMS.find((p) => p.customSlidesEnabled && p.customSlides?.length)?.id ?? 'poem-23';

/** A poem whose text is paginated by measurement. */
export const MEASURED_POEM = POEMS.find((p) => !p.customSlidesEnabled)?.id ?? 'poem-1';

export const PAGES = [
  '/',
  '/poems',
  `/poems/${MEASURED_POEM}`,
  `/poems/${CUSTOM_SLIDE_POEM}`,
  '/contact',
];

/**
 * Waits until the page is actually measurable: fonts resolved (they change wrapping) and
 * the image-gated reveal finished. Polls rather than sleeping a fixed time so it holds up
 * on a slow CI runner.
 */
export async function settled(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => document.fonts.ready);
  // The reveal latches a class once the first batch of images is cached; the loading
  // prompt disappearing is the observable signal that layout has stopped moving.
  await page
    .waitForFunction(() => !document.querySelector('.loading-prompt'), null, { timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(600);
}

import { SECTIONS } from '@hamstarter/shared';
import { expect, test } from './fixtures';

/**
 * Cloudinary URLs must survive the render path intact.
 *
 * The starter ships SVG placeholders, so there are no Cloudinary images in the default
 * content and an assertion over "whatever the page happens to load" would pass without
 * inspecting anything — a check that cannot fail. This supplies its own Cloudinary URLs by
 * overriding the content route, so the assertion always has real subject matter, stays
 * deterministic, and needs neither an account nor a network round-trip (fixtures.ts already
 * answers every res.cloudinary.com request with a transparent pixel).
 *
 * Two properties, both of which have been broken in the sibling Qalor site:
 *
 *  - the transform is applied, or the original multi-megabyte asset is served instead; and
 *  - the version segment survives exactly once. Dropping it makes a replaced image stick in
 *    browser caches for the full year these are served with; duplicating it is a 404.
 */

const CLOUD = 'https://res.cloudinary.com/dgk299isx/image/upload';
const VERSION = 'v1784831893';

/** The bundled sections, with every carousel slide pointed at a Cloudinary URL. */
function sectionsWithCloudinaryImages() {
  return SECTIONS.map((section) =>
    section.kind === 'carousel' && section.slides
      ? {
          ...section,
          slides: section.slides.map((slide, i) => ({
            ...slide,
            image: `${CLOUD}/${VERSION}/demo/project-${i}.png`,
          })),
        }
      : section,
  );
}

/** Every Cloudinary URL the page actually asks for, from `src` and each `srcset` candidate. */
async function renderedCloudinaryUrls(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll('img, link[rel="preload"][as="image"]')) {
      const attrs = [
        el.getAttribute('src') ?? '',
        el.getAttribute('srcset') ?? '',
        el.getAttribute('href') ?? '',
        el.getAttribute('imagesrcset') ?? '',
      ].join(' ');
      // Whole URLs, not a split on commas: the transform itself contains one (`q_auto,w_900`).
      for (const url of attrs.match(/https?:\/\/\S+?(?=\s|$)/g) ?? []) {
        if (url.includes('res.cloudinary.com')) found.push(url);
      }
    }
    return found;
  });
}

test('Cloudinary images are transformed and keep exactly one version', async ({ page }) => {
  await page.route('**/api/content', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sectionsWithCloudinaryImages()),
    }),
  );

  await page.goto('/');
  await page.locator('img').first().waitFor();
  const urls = await renderedCloudinaryUrls(page);

  // The guard that keeps the rest of this test honest. If the carousel stops rendering, or
  // the content override stops taking effect, every assertion below would pass over an empty
  // list and report success having checked nothing.
  expect(urls.length, 'no Cloudinary images rendered — this test checked nothing').toBeGreaterThan(
    0,
  );

  for (const url of urls) {
    expect(url, `${url} was not resized`).toMatch(/\/image\/upload\/[^/]*w_\d+/);
    // Lookahead rather than a consuming match: `/v1/v2/` overlaps on the middle slash, so a
    // `/\/v\d+\//g` count reports 1 for a doubled version — "fine" for the exact bug meant
    // to be caught here.
    expect(url.match(/\/v\d+(?=\/)/g) ?? [], `${url} lost or doubled its version`).toHaveLength(1);
  }
});

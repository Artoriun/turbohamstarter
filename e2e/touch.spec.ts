import type { Page } from '@playwright/test';
import { expect, MEASURED_POEM, settled, test } from './fixtures';

/**
 * Behaviour that only exists on a real touch device, run under the `mobile-touch` project
 * (`hasTouch`, `isMobile`) rather than the viewport-only projects the rest of the suite uses.
 *
 * The distinction is not academic. Every other project here is Desktop Chrome resized to a
 * phone: `pointer: fine`, no touch events, no drag-then-tap interaction at all. Two bugs in
 * sibling repos shipped past a fully green suite for exactly that reason — a card that needed
 * pressing twice after a drag, and a control that took a different code path on a coarse
 * pointer. Neither was reproducible in any project that existed at the time.
 */

/**
 * A real swipe.
 *
 * Playwright has `touchscreen.tap` but no drag, and dispatching TouchEvents through
 * `dispatchEvent` does not work — the Touch objects cannot be constructed from an init dict
 * there. CDP's Input domain injects the genuine article, which is what both the Motion drag
 * handler on the carousel and the reader's touchstart/touchend listeners are written against.
 */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
  });
  // Several moves rather than one: a single jump reads as a flick with no travel, and Motion
  // derives velocity from the intermediate points.
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 },
      ],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('tapping a carousel slide opens that poem on the first tap', async ({ page }) => {
  await page.goto('/');
  await settled(page);

  const link = page.locator('.carousel-link').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');

  await link.tap();
  await page.waitForURL(`**${href}`, { timeout: 15_000 });
  expect(page.url()).toContain(href);
});

test('a deliberate swipe on the carousel does not navigate', async ({ page }) => {
  await page.goto('/');
  await settled(page);

  const slide = page.locator('.carousel-slide').first();
  const box = await slide.boundingBox();
  if (!box) throw new Error('carousel slide has no box');
  const y = box.y + box.height / 2;

  // Well past the 50px threshold the drag handler paginates on, so this is unambiguously a
  // swipe and not a tap. The <Link> underneath calls preventDefault() while the drag flag is
  // set; if that flag were cleared too early, this would navigate.
  await swipe(page, { x: box.x + box.width * 0.85, y }, { x: box.x + box.width * 0.15, y });
  await page.waitForTimeout(900);

  expect(page.url(), 'a swipe should not open a poem').not.toContain('/poems/');
});

test('the carousel still navigates on the tap after a swipe', async ({ page }) => {
  // The regression this exists for: the drag flag outliving the drag and swallowing the next,
  // deliberate tap, so the card has to be pressed twice.
  await page.goto('/');
  await settled(page);

  const slide = page.locator('.carousel-slide').first();
  const box = await slide.boundingBox();
  if (!box) throw new Error('carousel slide has no box');
  const y = box.y + box.height / 2;

  await swipe(page, { x: box.x + box.width * 0.85, y }, { x: box.x + box.width * 0.15, y });
  await page.waitForTimeout(1200);

  const link = page.locator('.carousel-link').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  await link.tap();
  await page.waitForURL(`**${href}`, { timeout: 15_000 });
});

test('tapping a poem card in the grid opens the reader', async ({ page }) => {
  await page.goto('/poems');
  await settled(page);

  const card = page.locator('a[href*="/poems/"]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute('href');

  await card.tap();
  await page.waitForURL(`**${href}`, { timeout: 15_000 });
  await expect(page.locator('.poem-detail')).toBeVisible();
});

test('swiping the reader never leaves it blank', async ({ page }) => {
  await page.goto(`/poems/${MEASURED_POEM}`);
  await settled(page);

  const detail = page.locator('.poem-detail');
  await expect(detail).toBeVisible();
  const box = await detail.boundingBox();
  if (!box) throw new Error('poem detail has no box');
  const x = box.x + box.width / 2;

  expect((await detail.innerText()).trim().length).toBeGreaterThan(0);

  await swipe(page, { x, y: box.y + box.height * 0.8 }, { x, y: box.y + box.height * 0.2 });
  await page.waitForTimeout(1400);

  // Whether this poem has a second page depends on how it measured at this viewport, so the
  // assertion is the invariant that holds either way. A swipe that pages into an empty slide
  // is the failure worth catching, and it is not visible to any non-touch project.
  expect(
    (await detail.innerText()).trim().length,
    'the reader should never be left blank by a swipe',
  ).toBeGreaterThan(0);
});

import { expect, test } from './fixtures';

/**
 * Interaction tests for the home-page project carousel's drag gesture. Layout and
 * accessibility are already covered generically for every route (including `/`) by
 * layout.spec.ts and a11y.spec.ts; these are specific to the pointer-drag behaviour, which
 * nothing else exercises.
 */

test.describe('project carousel drag', () => {
  test('dragging past the threshold navigates to the next slide', async ({ page }) => {
    await page.goto('/');
    const frame = page.locator('.carousel-frame');
    // Harmless even though the carousel is already the first thing on the page: a no-op
    // if it's already in view, and cheap insurance if its position on the page ever moves.
    await frame.scrollIntoViewIfNeeded();
    // Scoped to the one slide that isn't aria-hidden: during a transition the outgoing and
    // incoming slides are briefly both in the DOM, and .carousel-overlay-title alone would
    // match both.
    const title = page.locator('.carousel-slide:not([aria-hidden]) .carousel-overlay-title');
    const before = await title.innerText();

    const box = await frame.boundingBox();
    if (!box) throw new Error('carousel frame has no bounding box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Comfortably past the 50px commit threshold, in steps so more than one pointermove
    // fires — a single teleport wouldn't exercise the same code path as a real drag.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 40, y, { steps: 3 });
    await page.mouse.move(x - 90, y, { steps: 3 });
    await page.mouse.up();

    await expect(title).not.toHaveText(before, { timeout: 1000 });
  });

  test('a drag under the threshold snaps back without changing the slide', async ({ page }) => {
    await page.goto('/');
    const frame = page.locator('.carousel-frame');
    await frame.scrollIntoViewIfNeeded();
    // Scoped to the one slide that isn't aria-hidden: during a transition the outgoing and
    // incoming slides are briefly both in the DOM, and .carousel-overlay-title alone would
    // match both.
    const title = page.locator('.carousel-slide:not([aria-hidden]) .carousel-overlay-title');
    const before = await title.innerText();

    const box = await frame.boundingBox();
    if (!box) throw new Error('carousel frame has no bounding box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 15, y, { steps: 2 }); // under the 50px threshold
    await page.mouse.up();
    await page.waitForTimeout(600); // the settle animation, so a false pass isn't just "too soon to tell"

    await expect(title).toHaveText(before);
  });

  test('a long drag does not produce horizontal page overflow', async ({ page }) => {
    await page.goto('/');
    const frame = page.locator('.carousel-frame');
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox();
    if (!box) throw new Error('carousel frame has no bounding box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 400, y, { steps: 10 });

    const overflows = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    await page.mouse.up();

    expect(overflows, 'dragging the carousel scrolled the page horizontally').toBe(false);
  });
});

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

/**
 * Activating a slide, which nothing covered.
 *
 * The drag tests above prove the gesture works; these prove the other outcome — that a press
 * which is *not* a drag still opens the project. A slide is a <Link>, so the failure mode is
 * not a modal refusing to open, it is navigation silently not happening.
 *
 * The distinction that matters is where the line between "tap" and "drag" sits, and it is
 * not the same for a finger as for a mouse. A drag deliberately suppresses the click that
 * follows it; if a finger's normal wander counts as a drag, tapping a card does nothing at
 * all. The sibling Qalor site, whose carousel is a port of this one, shipped exactly that to
 * a phone: cards had to be pressed twice.
 */
test.describe('project carousel activation', () => {
  const activeSlide = '.carousel-slide:not([aria-hidden])';

  test('clicking a slide opens its project', async ({ page }) => {
    await page.goto('/');
    const slide = page.locator(activeSlide).first();
    await slide.scrollIntoViewIfNeeded();
    const href = await slide.getAttribute('href');
    await slide.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('a deliberate drag does not open a project', async ({ page }) => {
    await page.goto('/');
    const frame = page.locator('.carousel-frame');
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox();
    if (!box) throw new Error('carousel frame has no bounding box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // Past the mouse intent threshold, so this is a drag and must stay on the page — the
    // counterpart to the tap tests, and what stops a fix for those from turning every short
    // drag into a navigation.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 15, y, { steps: 2 });
    await page.mouse.move(x - 30, y, { steps: 2 });
    await page.mouse.up();

    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('project carousel drag intent by pointer type', () => {
  /**
   * Whether a gesture counts as a drag is what decides if the click survives, and a drag
   * suppresses it. So the threshold *is* the tap behaviour, and it differs by pointer type.
   *
   * Asserted through the drag state rather than through navigation, deliberately: synthetic
   * pointer events are untrusted, so they never produce the click a real finger would, and a
   * navigation assertion here would be testing Playwright rather than the carousel.
   * `page.mouse` reports pointerType 'mouse' even in a touch context, which is why these
   * dispatch the events directly.
   */
  async function gesture(page: import('@playwright/test').Page, dx: number, pointerType: string) {
    const frame = page.locator('.carousel-frame');
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox();
    if (!box) throw new Error('carousel frame has no bounding box');
    const clientY = box.y + box.height / 2;
    const startX = box.x + box.width / 2;
    const send = (type: string, clientX: number) =>
      frame.dispatchEvent(type, { pointerId: 1, pointerType, clientX, clientY, isPrimary: true });

    await send('pointerdown', startX);
    for (let i = 1; i <= 3; i++) await send('pointermove', startX + (dx * i) / 3);
    const engaged = (await frame.getAttribute('class'))?.includes('is-dragging') ?? false;
    await send('pointerup', startX + dx);
    return engaged;
  }

  test('a finger wander of 12px is a tap, not a drag', async ({ page }) => {
    await page.goto('/');
    // Under DRAG_INTENT_TOUCH. Over DRAG_INTENT_MOUSE — which is the bug: at the mouse
    // threshold this was a drag, so the click that would have opened the project was
    // suppressed and the tap did nothing.
    expect(await gesture(page, -12, 'touch')).toBe(false);
  });

  test('a finger movement past the touch threshold is a drag', async ({ page }) => {
    await page.goto('/');
    expect(await gesture(page, -40, 'touch')).toBe(true);
  });

  test('a mouse keeps the tighter threshold', async ({ page }) => {
    await page.goto('/');
    // A mouse does not wander, so it should still engage early — raising the touch
    // threshold must not make dragging with a pointer feel sluggish.
    expect(await gesture(page, -12, 'mouse')).toBe(true);
  });
});

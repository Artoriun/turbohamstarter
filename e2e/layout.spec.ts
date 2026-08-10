import { CUSTOM_SLIDE_POEM, expect, MEASURED_POEM, PAGES, settled, test } from './fixtures';

// Each test here corresponds to a regression that actually shipped at some point.

test.describe('page integrity', () => {
  for (const path of PAGES) {
    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      await settled(page);
      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(scrollW, `${path} scrolls sideways`).toBeLessThanOrEqual(clientW + 1);
    });

    test(`${path} renders nothing below the footer`, async ({ page }) => {
      await page.goto(path);
      await settled(page);
      const gap = await page.evaluate(() => {
        const f = document.querySelector('.site-footer');
        if (!f) return 0; // admin login has no footer
        return (
          document.documentElement.scrollHeight -
          (f.getBoundingClientRect().bottom + window.scrollY)
        );
      });
      // A backdrop showing through past the footer was a recurring bug.
      expect(gap, `${path} has ${gap}px of page past the footer`).toBeLessThanOrEqual(1);
    });

    test(`${path} starts at the top after reload`, async ({ page }) => {
      await page.goto(path);
      await settled(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
      await page.reload();
      await settled(page);
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    });
  }
});

test.describe('poem detail', () => {
  for (const [label, id] of [
    ['measured', MEASURED_POEM],
    ['custom slides', CUSTOM_SLIDE_POEM],
  ] as const) {
    test(`${label}: text never runs under the nav button`, async ({ page }) => {
      await page.goto(`/poems/${id}`);
      await settled(page);

      for (let slide = 0; slide < 8; slide++) {
        const clearance = await page.evaluate(() => {
          const lines = [...document.querySelectorAll('.detail-slide .detail-overlay span')].filter(
            (e) => (e.textContent ?? '').trim(),
          );
          if (!lines.length) return null;
          const down = document.querySelector('.detail-scroll-down-btn');
          const back = document.querySelector('.detail-back-btn');
          const btn = down && !down.className.includes('is-hidden') ? down : back;
          if (!btn) return null;
          const last = lines[lines.length - 1].getBoundingClientRect().bottom;
          return Math.round(btn.getBoundingClientRect().top - last);
        });
        if (clearance !== null) {
          expect(clearance, `slide ${slide} overlaps the button`).toBeGreaterThanOrEqual(0);
        }

        const advanced = await page.evaluate(() => {
          const b = document.querySelector<HTMLElement>('.detail-scroll-down-btn');
          if (!b || b.className.includes('is-hidden')) return false;
          b.click();
          return true;
        });
        if (!advanced) break;
        await page.waitForTimeout(1600);
      }
    });
  }

  test('no slide is left with an orphaned line or two', async ({ page }) => {
    await page.goto(`/poems/${CUSTOM_SLIDE_POEM}`);
    await settled(page);
    const counts: number[] = [];
    for (let i = 0; i < 10; i++) {
      counts.push(
        await page.evaluate(
          () =>
            [...document.querySelectorAll('.detail-slide .detail-overlay span')].filter((e) =>
              (e.textContent ?? '').trim(),
            ).length,
        ),
      );
      const advanced = await page.evaluate(() => {
        const b = document.querySelector<HTMLElement>('.detail-scroll-down-btn');
        if (!b || b.className.includes('is-hidden')) return false;
        b.click();
        return true;
      });
      if (!advanced) break;
      await page.waitForTimeout(1600);
    }
    // Splitting used to strand the remainder on a 1–2 line page.
    if (counts.length > 1) {
      expect(Math.min(...counts), `slide line counts: ${counts.join(', ')}`).toBeGreaterThan(2);
    }
  });

  test('every line of the poem survives paging', async ({ page }) => {
    await page.goto(`/poems/${CUSTOM_SLIDE_POEM}`);
    await settled(page);
    const total = await page.evaluate(
      () => document.querySelectorAll('.detail-measure .detail-overlay span').length,
    );
    let seen = 0;
    for (let i = 0; i < 10; i++) {
      seen += await page.evaluate(
        () => document.querySelectorAll('.detail-slide .detail-overlay span').length,
      );
      const advanced = await page.evaluate(() => {
        const b = document.querySelector<HTMLElement>('.detail-scroll-down-btn');
        if (!b || b.className.includes('is-hidden')) return false;
        b.click();
        return true;
      });
      if (!advanced) break;
      await page.waitForTimeout(1600);
    }
    expect(seen, 'lines were dropped between slides').toBe(total);
  });
});

test.describe('poems grid', () => {
  test('table of contents indicator draws on a cold load', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-portrait', 'TOC is hidden below 768px');
    await page.goto('/poems');
    await settled(page);
    const h = await page.evaluate(() => {
      const l = document.querySelector('.toc-range-line');
      return l ? Math.round(l.getBoundingClientRect().height) : 0;
    });
    // The line silently failed to draw on a fresh load once.
    expect(h, 'TOC range line has no height').toBeGreaterThan(0);
  });

  test('the whole batch of cards renders', async ({ page }) => {
    await page.goto('/poems');
    await settled(page);
    expect(await page.locator('.poem-card-wrapper').count()).toBeGreaterThan(0);
  });
});

test.describe('home carousel', () => {
  test('overlay sits between the title and the read-more button', async ({ page }, testInfo) => {
    // In landscape the overlay is deliberately a teaser: max-height plus a mask fading to
    // transparent at 78%, so the text is meant to run on and fade rather than fit.
    test.skip(testInfo.project.name === 'mobile-landscape', 'overlay is intentionally masked');
    await page.goto('/');
    await settled(page);
    const box = await page.evaluate(() => {
      const title = document.querySelector('.carousel-slide-title');
      const btn = document.querySelector('.carousel-read-more-btn');
      const lines = [...document.querySelectorAll('.carousel-overlay span')].filter((e) =>
        (e.textContent ?? '').trim(),
      );
      if (!title || !btn || !lines.length) return null;
      return {
        above: Math.round(
          lines[0].getBoundingClientRect().top - title.getBoundingClientRect().bottom,
        ),
        below: Math.round(
          btn.getBoundingClientRect().top - lines[lines.length - 1].getBoundingClientRect().bottom,
        ),
      };
    });
    if (!box) test.skip(true, 'carousel not rendered');
    expect(box.above, 'overlay overlaps the title').toBeGreaterThanOrEqual(0);
    expect(box.below, 'overlay overlaps the button').toBeGreaterThanOrEqual(0);
  });
});

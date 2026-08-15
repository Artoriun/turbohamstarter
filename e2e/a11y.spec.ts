import AxeBuilder from '@axe-core/playwright';
import { expect, PAGES, test } from './fixtures';

/**
 * Accessibility, checked in the browser rather than only in a Lighthouse run.
 *
 * Lighthouse audits one page at one width. That is how a failing contrast ratio on the
 * language toggle shipped: the audit ran at a mobile width, where the toggle is behind the
 * hamburger and never rendered, so nothing looked at it. This runs across every page, at
 * each viewport in the matrix, in both themes — which is where the combinations actually
 * live.
 *
 * Contrast in particular cannot be reasoned about from the token values alone. The toggle's
 * text was on a track tinted 7% darker than the page, so a colour that passed against the
 * background failed in place.
 */
for (const path of PAGES) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${path} has no accessibility violations (${theme})`, async ({ page }) => {
      await page.goto(path);
      if (theme === 'dark') {
        await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
        // The theme transitions colours; sampling mid-fade would compare against a blend
        // that is on screen for 200ms and never settles there.
        await page.waitForTimeout(300);
      }

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Named rather than counted, so a failure says what broke and where instead of
      // "expected 0, got 1".
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });
  }
}

test('the language toggle is legible in both themes', async ({ page }) => {
  await page.goto('/');
  // A direct regression test for the shipped defect: the inactive language sat at 4.19:1
  // against its own track. Scoped tighter than the sweep above so the reason survives in
  // the test name if the general rule is ever relaxed.
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate(
      (t) => document.documentElement.classList.toggle('dark-mode', t === 'dark'),
      theme,
    );
    await page.waitForTimeout(300);
    const { violations } = await new AxeBuilder({ page })
      .include('.lang-toggle')
      .withRules(['color-contrast'])
      .analyze();
    expect(violations, `${theme} mode`).toEqual([]);
  }
});

/**
 * The same sweep with the mascot popover open.
 *
 * The loop above audits each page as it loads, which means it has never seen anything that
 * only exists after a press. An interactive element no test opens is invisible to an
 * accessibility check in exactly the way it is invisible to a layout one — and this popover
 * introduces a control with expanded state, a new colour on body copy, and content that is
 * decorative to the eye and has to carry a name for a screen reader.
 */
for (const theme of ['light', 'dark'] as const) {
  test(`the mascot popover has no accessibility violations (${theme})`, async ({ page }) => {
    await page.goto('/');
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await page.waitForTimeout(300);
    }

    await page.locator('.mascot-mention-btn').click();
    await expect(page.locator('.mascot-pop')).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    ).toEqual([]);
  });
}

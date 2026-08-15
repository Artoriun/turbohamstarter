import { expect, PAGES, test } from './fixtures';

/**
 * Layout assertions, not feature tests.
 *
 * These catch the class of regression that unit tests cannot see and a human only notices
 * on the wrong device: content overflowing sideways, elements rendering past the footer,
 * a nav that traps focus, a form that cannot be submitted at 412px wide. The Playwright
 * matrix is viewports rather than browsers for the same reason.
 */

for (const path of PAGES) {
  test.describe(path, () => {
    test('has no horizontal overflow', async ({ page }) => {
      await page.goto(path);
      // scrollWidth beyond clientWidth is the definition of a sideways scrollbar. +1 for
      // sub-pixel rounding, which is not a real overflow.
      const overflows = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 1;
      });
      expect(overflows, `${path} scrolls horizontally`).toBe(false);
    });

    test('renders nothing below the footer', async ({ page }) => {
      await page.goto(path);
      const footer = page.locator('.site-footer');
      await expect(footer).toBeVisible();
      const stray = await page.evaluate(() => {
        const footerEl = document.querySelector('.site-footer');
        if (!footerEl) return 0;
        const bottom = footerEl.getBoundingClientRect().bottom + window.scrollY;
        return [...document.body.querySelectorAll('*')].filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          return r.top + window.scrollY > bottom + 1;
        }).length;
      });
      expect(stray, `${path} has content past the footer`).toBe(0);
    });

    test('has exactly one h1', async ({ page }) => {
      await page.goto(path);
      // More than one h1 is a real accessibility problem and the easiest to introduce by
      // copying a page; zero means the page has no accessible title.
      await expect(page.locator('h1')).toHaveCount(1);
    });
  });
}

test('the header nav reaches every page', async ({ page }) => {
  await page.goto('/');
  for (const [label, expected] of [
    ['About', '/about'],
    ['Contact', '/contact'],
  ] as const) {
    // On mobile the nav is behind a toggle; open it when present.
    const toggle = page.locator('.nav-toggle');
    if (await toggle.isVisible()) await toggle.click();
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${expected}$`));
    await page.goto('/');
  }
});

test('the contact form is usable and validates before sending', async ({ page }) => {
  await page.goto('/contact');
  // Submitting empty must not navigate away or silently do nothing.
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.locator('.form-error')).toBeVisible();
});

test('an unknown route renders the not-found page, not a blank shell', async ({ page }) => {
  await page.goto('/definitely-not-a-page');
  await expect(page.locator('h1')).toBeVisible();
  const text = await page.locator('#main').innerText();
  expect(text.trim().length).toBeGreaterThan(10);
});

test('dark mode toggles and persists across a reload', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('.nav-toggle');
  if (await toggle.isVisible()) await toggle.click();

  const before = await page.evaluate(() =>
    document.documentElement.classList.contains('dark-mode'),
  );
  const isDark = () =>
    page.evaluate(() => document.documentElement.classList.contains('dark-mode'));

  await page.locator('.theme-toggle').click();
  // Polled rather than read once: the class is applied by React on the next commit, and a
  // bare read immediately after the click sometimes lands before it. That made this test
  // fail intermittently — on a different project each run, which is the signature of a race
  // rather than a real regression.
  await expect.poll(isDark, { timeout: 3000 }).toBe(!before);
  const after = !before;

  await page.reload();
  await expect.poll(isDark, { timeout: 3000 }).toBe(after);
});

test('the language switcher changes visible copy', async ({ page }) => {
  await page.goto('/contact');
  const toggle = page.locator('.nav-toggle');
  if (await toggle.isVisible()) await toggle.click();

  const buttons = page.locator('.lang-btn');
  // Only meaningful with more than one locale registered; skip rather than fail so
  // deleting a language does not break the suite.
  test.skip((await buttons.count()) < 2, 'only one locale registered');

  const before = await page.locator('h1').innerText();
  await buttons.nth(1).click();
  await expect(page.locator('h1')).not.toHaveText(before);
});

test('the admin portal stays in the default language regardless of the URL prefix', async ({
  page,
}) => {
  // Regression test: LanguageProvider/provideLanguage's `scoped` option existed on both
  // frontends but nothing ever actually passed it, so /ja/admin showed the portal's own UI
  // in Japanese — depending on which language-prefixed page an editor happened to arrive
  // from — rather than staying consistent. No login needed: SignIn already reads useT()
  // from the same scope AdminPanel does, so this covers the fix without needing a real API.
  await page.goto('/ja/admin');

  // The portal's own heading — scoped, must stay English regardless of the /ja/ prefix.
  await expect(page.locator('h1')).toHaveText('Admin');

  // The shared Header is a sibling of the scoped subtree, not a descendant, so it must be
  // unaffected and keep reflecting the URL's actual language.
  const toggle = page.locator('.nav-toggle');
  if (await toggle.isVisible()) await toggle.click();
  await expect(page.getByRole('link', { name: '概要', exact: true })).toBeVisible();
});

test('a page change fades the old page out and the new one in, never the reverse', async ({
  page,
}) => {
  await page.goto('/');

  // On a narrow viewport the links sit behind the hamburger, and the closed menu is
  // visibility:hidden — deliberately, so its links stay out of the tab order — which also
  // makes them unclickable until it is opened.
  const openNav = async () => {
    const toggle = page.locator('.nav-toggle');
    if (await toggle.isVisible()) {
      await toggle.click();
      await page.waitForTimeout(350); // the panel's own transition
    }
  };

  // The first click mounts the animated tree; the second is the steady state a visitor
  // spends all their time in, and is where this used to go wrong.
  await openNav();
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    (window as unknown as { __t: unknown[] }).__t = [];
    const start = performance.now();
    const tick = () => {
      const w = document.querySelector('#main > div');
      (window as unknown as { __t: unknown[] }).__t.push({
        op: w ? Number.parseFloat(getComputedStyle(w).opacity) : null,
        h1: document.querySelector('#main h1')?.textContent ?? null,
      });
      if (performance.now() - start < 900) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openNav();
  await page.getByRole('link', { name: 'Contact', exact: true }).click();
  await page.waitForTimeout(1100);

  const trace = (await page.evaluate(
    () => (window as unknown as { __t: { op: number | null; h1: string | null }[] }).__t,
  )) as { op: number | null; h1: string | null }[];

  const firstNew = trace.findIndex((f) => f.h1?.includes('Contact'));
  expect(firstNew, 'the incoming page never rendered').toBeGreaterThan(-1);

  // The defect this pins: React Router swapping the children while AnimatePresence still
  // held the outgoing wrapper, so the incoming page appeared at full opacity and then
  // played the *exit* animation on itself — content arriving, then animating.
  expect(
    trace[firstNew].op,
    'the incoming page was already visible before it animated in',
  ).toBeLessThan(0.25);
});

// Headless Chromium reports prefers-reduced-motion: reduce, so without this the landing
// animation is switched off and the test below would pass against a static page.
test.describe('the landing entrance', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a page arrived at directly animates in, without ever hiding its content', async ({
    page,
  }) => {
    // Recorded from inside the page: the entrance is short, and a round-trip per sample
    // would miss most of it.
    await page.addInitScript(() => {
      (window as unknown as { __f: unknown[] }).__f = [];
      const tick = () => {
        const items = [...document.querySelectorAll('.page-landing .page > *')];
        if (items.length) {
          (window as unknown as { __f: unknown[] }).__f.push(
            items.map((el) => {
              const s = getComputedStyle(el);
              const m = s.transform;
              return {
                y: m === 'none' ? 0 : Number.parseFloat(m.split(',')[5]),
                op: Number.parseFloat(s.opacity),
              };
            }),
          );
        }
        if (performance.now() < 2000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.goto('/');
    await page.waitForTimeout(2100);

    const frames = (await page.evaluate(
      () => (window as unknown as { __f: { y: number; op: number }[][] }).__f,
    )) as { y: number; op: number }[][];

    expect(frames.length, 'no frames recorded').toBeGreaterThan(10);

    // It moved at some point — this is what was missing: refreshing showed a static page
    // while navigating between pages animated.
    expect(
      frames.some((f) => f.some((i) => Math.abs(i.y) > 0.5)),
      'the landing page never animated',
    ).toBe(true);

    // Never transparent. An element at opacity 0 is not a Largest Contentful Paint
    // candidate, so a fade here would hand back the head start prerendering buys —
    // measured at 36ms against 465ms when the same keyframe also animated opacity.
    expect(
      frames.every((f) => f.every((i) => i.op === 1)),
      'the entrance faded content in, which delays LCP',
    ).toBe(true);

    // And it settles, rather than leaving the page permanently offset.
    expect(frames.at(-1)?.every((i) => Math.abs(i.y) < 0.01)).toBe(true);
  });
});

/**
 * The mascot's name in the hero body opens a small popover naming him.
 *
 * Worth its own tests because nothing else in the suite ever presses it: an interactive
 * element that no test opens is invisible to the layout assertions (which measure the closed
 * page) and to the accessibility sweep (which audits what is on screen). That is precisely
 * how a control ships broken while every check stays green.
 */
test.describe('the mascot mention', () => {
  test('opens and closes, and leaves the brand name alone', async ({ page }) => {
    await page.goto('/');
    const mention = page.locator('.mascot-mention-btn');

    // Exactly one. The rule that keeps the product name out of it is unit-tested in
    // packages/shared; what this checks is that the hero body is actually rendered through
    // it, and that the heading beside it is untouched.
    await expect(mention).toHaveCount(1);
    await expect(mention).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('h1')).toContainText('TurboHamstarter');

    await mention.click();
    await expect(page.locator('.mascot-pop')).toBeVisible();
    await expect(mention).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(page.locator('.mascot-pop')).toHaveCount(0);
    await expect(mention).toHaveAttribute('aria-expanded', 'false');
  });

  test('is reachable and operable from the keyboard', async ({ page }) => {
    await page.goto('/');
    const mention = page.locator('.mascot-mention-btn');
    await mention.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.mascot-pop')).toBeVisible();
  });

  test('the popover sits above the word, not beside it', async ({ page }) => {
    // Geometry, because the other assertions in here do not constrain it: a popover that
    // rendered inline — which is what the Vue package did when its stylesheet was missing
    // these rules — is visible, is dismissible, and overflows nothing. It is simply in the
    // wrong place, and only a position check says so.
    await page.goto('/');
    const mention = page.locator('.mascot-mention-btn');
    await mention.click();
    const pop = page.locator('.mascot-pop');
    await expect(pop).toBeVisible();

    const word = await mention.boundingBox();
    const box = await pop.boundingBox();
    if (!word || !box) throw new Error('no box to measure');

    expect(box.y + box.height, 'the popover should sit above the word').toBeLessThanOrEqual(
      word.y + 1,
    );
    // And roughly over it, rather than off to one side.
    const overlap = Math.min(box.x + box.width, word.x + word.width) - Math.max(box.x, word.x);
    expect(overlap, 'the popover should be anchored over the word').toBeGreaterThan(0);
  });

  test('the open popover does not push the page sideways', async ({ page }) => {
    // An absolutely positioned popover anchored to a word near the edge is the easiest way
    // to introduce horizontal overflow, and the page-level overflow assertions only ever see
    // it closed.
    await page.goto('/');
    await page.locator('.mascot-mention-btn').click();
    await expect(page.locator('.mascot-pop')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'the open popover overflows horizontally').toBeLessThanOrEqual(0);
  });
});

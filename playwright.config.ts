import { defineConfig, devices } from '@playwright/test';

// Which frontend the suite runs against — 'web' (React, the default, unchanged from
// before this was parameterized) or 'web-vue'. Every spec here asserts on rendered DOM,
// CSS classes and geometry rather than framework internals, so the same suite runs
// against either target unmodified.
const TARGET = process.env.TARGET ?? 'web';

/**
 * `E2E_TARGET=dist` runs against the built, prerendered output at its real base path rather
 * than the dev server at the domain root. Only e2e/dist.spec.ts runs there — see that file.
 */
const DIST_TARGET = process.env.E2E_TARGET === 'dist';
const DIST_PORT = Number(process.env.DIST_PORT ?? (TARGET === 'web-vue' ? 3731 : 3730));
const BASE_PATH = (process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');
const DIST_URL = `http://localhost:${DIST_PORT}${BASE_PATH}`;

// The regressions a site like this actually suffers are layout ones at specific viewports
// — content overflowing sideways, elements past the footer, a nav that only breaks at one
// width. So the matrix is viewports rather than browsers.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A CI runner has 2 cores; oversubscribing it makes these timing-sensitive layout
  // measurements flaky rather than faster.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  timeout: 90_000,
  use: {
    baseURL: DIST_TARGET ? DIST_URL : `http://localhost:${process.env.WEB_PORT ?? 3720}`,
    trace: 'on-first-retry',
    // Locally Playwright reuses an already-warm dev server. CI cold-starts Vite, so the
    // first navigation waits on dependency pre-bundling and blows the 30s default.
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-portrait',
      use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 915 }, isMobile: false },
    },
    {
      name: 'mobile-landscape',
      use: { ...devices['Desktop Chrome'], viewport: { width: 915, height: 412 }, isMobile: false },
    },
    {
      // The only project with real touch. The three above are Desktop Chrome at a smaller
      // size with isMobile: false, so they report `pointer: fine` and fire no touch events —
      // which is how a carousel that suppressed taps on a phone kept a green suite.
      name: 'mobile-touch',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: DIST_TARGET
    ? {
        command: `node scripts/serve-dist.mjs ${DIST_PORT}`,
        url: DIST_URL,
        // Never reuse: a stray dev server on this port would be silently tested instead of
        // dist, and the run would report green having tested the wrong thing entirely.
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: `npm run dev --workspace=packages/${TARGET}`,
        url: `http://localhost:${process.env.WEB_PORT ?? 3720}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

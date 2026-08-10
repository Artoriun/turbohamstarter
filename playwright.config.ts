import { defineConfig, devices } from '@playwright/test';

/**
 * `E2E_TARGET=dist` runs the suite against the built, prerendered output served at the site's
 * GitHub Pages base path, instead of the dev server at the domain root.
 *
 * Both halves matter and neither is visible to the default target: prerendering is where a
 * first-paint/hydration mismatch lives, and the base path is where a root-absolute link that
 * escapes the site lives. The dev server has neither.
 */
const DIST_TARGET = process.env.E2E_TARGET === 'dist';
// Not 3210: that port hosts a sibling project's tunneled dev server on this machine, and
// binding over it would take down something someone else is using.
const DIST_PORT = 3260;
const BASE_PATH = '/kov-cs-poetry/';

// The regressions this project actually suffers are layout ones at specific viewports —
// text running under a button, the footer moving, content past the footer. So the matrix
// is viewports rather than browsers.
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
    baseURL: DIST_TARGET ? `http://localhost:${DIST_PORT}${BASE_PATH}` : 'http://localhost:3000',
    trace: 'on-first-retry',
    // Locally Playwright reuses an already-warm dev server. CI cold-starts Vite, so the
    // first navigation waits on dependency pre-bundling and blows the 30s default.
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: 'desktop',
      // Without testIgnore the touch spec runs here too, on a project with no touch support —
      // testMatch on the mobile-touch project below constrains only that project.
      testIgnore: /touch\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Pixel 8a, the device this is checked on
      name: 'mobile-portrait',
      testIgnore: /touch\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 915 }, isMobile: false },
    },
    {
      name: 'mobile-landscape',
      testIgnore: /touch\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 915, height: 412 }, isMobile: false },
    },
    {
      // The three projects above are Desktop Chrome at a phone's size: no touch events, and
      // `pointer: fine`. That is a viewport test, not a device test, and it is why touch-only
      // bugs have shipped from a green suite in sibling repos — a tap that needed pressing
      // twice after a drag, and a control that behaved differently on a coarse pointer.
      //
      // Scoped to its own spec with `testMatch` rather than run across the whole suite: the
      // layout assertions are tuned to the projects above, and running them again under touch
      // would double the runtime to re-measure the same geometry.
      name: 'mobile-touch',
      testMatch: /touch\.spec\.ts/,
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
        url: `http://localhost:${DIST_PORT}${BASE_PATH}`,
        // Never reuse: a stray dev server on this port would be silently measured instead of
        // dist, and the run would report green having tested the wrong thing entirely.
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : {
        command: 'npm run dev --workspace=packages/web',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});

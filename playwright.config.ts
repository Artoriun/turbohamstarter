import { defineConfig, devices } from '@playwright/test';

// Which frontend the suite runs against — 'web' (React, the default, unchanged from
// before this was parameterized) or 'web-vue'. Every spec here asserts on rendered DOM,
// CSS classes and geometry rather than framework internals, so the same suite runs
// against either target unmodified.
const TARGET = process.env.TARGET ?? 'web';

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
    baseURL: `http://localhost:${process.env.WEB_PORT ?? 3210}`,
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
  ],
  webServer: {
    command: `npm run dev --workspace=packages/${TARGET}`,
    url: `http://localhost:${process.env.WEB_PORT ?? 3210}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

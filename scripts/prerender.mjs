#!/usr/bin/env node
/**
 * Prerender every public route to a static HTML file.
 *
 * GitHub Pages serves a single-page app by falling back to 404.html, which means every URL
 * except / answers with an HTTP 404 status. Crawlers do not index 404s, and the ones that
 * run JavaScript (essentially Googlebot, on a deferred second pass) were the only ones
 * seeing content at all — everything else got `<div id="root"></div>`.
 *
 * Booting the built app in a real browser and writing out the resulting DOM fixes both:
 * each route becomes an ordinary file at its own path, so Pages returns 200, and the text
 * is in the markup before any script runs. The app still boots on top and takes over with
 * live API data, so an admin edit is never more than one deploy from being indexed.
 *
 * Uses Playwright because it is already a dev dependency — no SSR runtime, no second
 * framework. Content is fetched once from the live API and then served to the browser from
 * a route stub, so the build stays current without every page load hitting the API, and a
 * single fetch is the only thing that can fail.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DEFAULT_LANG,
  LANGS,
  langPath,
  metaForRoute,
  ROUTES,
  SECTIONS,
  SITE_AUTHOR,
  SITE_TITLE,
} from '@hamstarter/shared';
import { chromium } from '@playwright/test';

// Where the site will actually live. Used for canonicals and the sitemap, so getting it
// wrong points crawlers at the wrong host.
const SITE = (process.env.SITE_URL ?? 'http://localhost:4173').replace(/\/$/, '');
// Must match vite.config.ts. '/' for a user site or custom domain, '/<repo>/' for a
// GitHub Pages project site.
const BASE = process.env.BASE_PATH ?? '/';
// Which frontend to prerender — 'web' (React, the default, unchanged from before this was
// parameterized) or 'web-vue'. Everything below that differs between the two frontends
// hangs off this one constant.
const TARGET = process.env.TARGET ?? 'web';
const DIST = new URL(`../packages/${TARGET}/dist/`, import.meta.url).pathname;
const WEB = new URL(`../packages/${TARGET}/`, import.meta.url).pathname;
// Detected from the package's own dependencies rather than assumed from TARGET: in this
// monorepo 'web' always means React, but a published single-frontend repo (see
// scripts/publish-target.mjs) renames whichever frontend it ships to packages/web, so a
// published Vue repo has Vue source living at the 'web' target.
const isVue =
  'vue' in (JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8')).dependencies ?? {});
// React mounts to #root, Vue to #app — see each package's index.html/main.ts(x).
const ROOT_ID = isVue ? 'app' : 'root';
// Distinct per target: the monorepo's own ci.yml prerenders React then Vue back-to-back in
// the same job (each published single-frontend repo only ever runs one), and a shared port
// let the second `vite preview --strictPort` race the first server's teardown — the loser
// either failed to bind or, worse, bound fine while the other process was still exiting and
// then briefly served the wrong app's markup to the wrong target's readiness check.
const PORT = isVue ? 4179 : 4178;

// 1x1 transparent PNG, substituted for every remote image so the capture never waits on
// a CDN it does not control.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Prefer the live API so a rebuild picks up whatever is in the admin portal. Falling back
 * to the bundled content keeps a sleeping free-tier instance from publishing an empty
 * site — but the fallback is announced, because silently shipping stale content is the
 * worse failure: visitors would see the edit (the app fetches at runtime) while every
 * crawler kept the old text, with nothing in the build log to explain why.
 */
async function loadContent() {
  const api = (process.env.VITE_API_URL ?? '').replace(/^http:\/\//, 'https://');
  const bundled = SECTIONS.filter((s) => !s.deleted);
  if (!api) {
    console.warn('! VITE_API_URL not set — prerendering from bundled content');
    return bundled;
  }
  try {
    const res = await fetch(`${api}/api/content`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty or malformed response');
    console.log(`✓ prerendering from the live API (${data.length} sections)`);
    return data.filter((s) => !s.deleted);
  } catch (err) {
    console.warn(`! live API unreachable (${err.message}) — prerendering from bundled content`);
    return bundled;
  }
}

const live = await loadContent();

/**
 * Hydration compares the client's first render against this markup, and the client seeds
 * ContentContext from the bundled SECTIONS. If the API returned something different — i.e.
 * anything has been edited in the portal — the two disagree, React throws the prerendered
 * DOM away, and the Largest Contentful Paint candidate goes with it. Shipping the exact
 * sections used keeps them in step.
 *
 * A starter's content is small, so the whole array is embedded. If yours grows past a few
 * KB, send only the difference from the bundle instead.
 */
const contentScript = `<script>window.__CONTENT__=${JSON.stringify(live).replace(/</g, '\\u003c')}</script>`;

/**
 * Every route in every language. The default language sits at the root and the others take
 * a path prefix, which is what makes them prerenderable at all: static hosting serves one
 * file per path and ignores the query, so ?lang= would give every language the same HTML.
 *
 * Titles and descriptions come from the shared helper the running app also uses, so the
 * prerendered <title> and the one useRouteMeta sets on navigation cannot drift apart.
 */
const routes = LANGS.flatMap((lang) =>
  ROUTES.map((path) => ({
    path,
    lang,
    url: langPath(path, lang),
    ...metaForRoute(path, live, lang),
  })),
);

/**
 * Preload the fonts the page actually renders with.
 *
 * Fontsource declares font-display: swap, and the browser only discovers the file after it
 * has fetched and parsed the CSS — so the first paint uses the fallback and the text
 * reflows when the real font lands. Measured at 1.7s on a throttled connection, moving the
 * h1 by 54px. A preload starts the download alongside the HTML instead, so it is usually
 * there before first paint.
 *
 * All three faces the site declares — upright, italic and mono, latin only. The italic is
 * not optional here: it sets the accent clause in the hero, which is above the fold.
 *
 * crossorigin is required even same-origin — font requests are made in CORS mode, and
 * without it the preload is fetched a second time rather than reused.
 */
const fontPreloads = readdirSync(join(DIST, 'assets'))
  .filter((f) => /^geist(-mono)?-latin-wght-(normal|italic)-.*\.woff2$/.test(f))
  .map(
    (f) =>
      `<link rel="preload" as="font" type="font/woff2" crossorigin href="${BASE}assets/${f}" />`,
  )
  .join('\n    ');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The URL that actually serves a 200. Pages writes each route as a directory index, so it
 * 301s /about to /about/; a canonical naming the redirecting form points crawlers at a hop
 * instead of at the page.
 */
const canonical = (url) => `${SITE}${BASE}${url === '/' ? '' : `${url.slice(1)}/`}`;

/**
 * Per-route head. Deliberately no <meta name="keywords">: ignored by every major engine
 * since 2009. The indexable signal is the text now sitting in the body.
 */
function head(route) {
  const url = canonical(route.url);
  const tags = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    fontPreloads,
    // Tells search engines these pages are translations of one another rather than
    // duplicates competing with each other. x-default points at the language served from
    // the root, which is what a visitor with no matching preference should get.
    ...LANGS.map(
      (l) =>
        `<link rel="alternate" hreflang="${l}" href="${esc(canonical(langPath(route.path, l)))}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical(langPath(route.path, DEFAULT_LANG)))}" />`,
  ];

  // One WebSite node on the home page is enough for a portfolio; per-page Article markup
  // on a site this size adds noise rather than signal.
  // Default-language home only: one WebSite node per site, not one per translation.
  if (route.path === '/' && route.lang === DEFAULT_LANG) {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_TITLE,
        url,
        author: { '@type': 'Person', name: SITE_AUTHOR },
      })}</script>`,
    );
  }
  return tags.join('\n    ');
}

// ---- serve the built app ----------------------------------------------------
const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort', '--outDir', 'dist'],
  { cwd: WEB, stdio: 'ignore' },
);
const stop = () => server.kill();
process.on('exit', stop);
process.on('SIGINT', () => {
  stop();
  process.exit(1);
});

const origin = `http://localhost:${PORT}`;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(`${origin}${BASE}`);
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

// ---- render -----------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Tells the app it is being captured, so it can skip anything whose result depends on this
// viewport. See packages/web/src/lib/prerendered.ts.
await page.addInitScript(() => {
  window.__PRERENDERING__ = true;
});
await page.route('**/api/content', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(live) }),
);
await page.route('**res.cloudinary.com/**', (r) =>
  r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
);
// Stubbed rather than left to hit the real endpoint: unstubbed, every route on every build
// would fire a real Cloudflare Web Analytics beacon, polluting live visitor counts with
// prerender traffic and making `waitUntil: 'networkidle'` wait on a host this script does
// not control.
await page.route('**static.cloudflareinsights.com/**', (r) => r.fulfill({ status: 204 }));

/**
 * Captured before anything is written. Output must be built from this rather than from the
 * live DOM: the preview server serves out of the same dist we are writing into, so once
 * index.html has the home page's tags, every later route is served that as the SPA
 * fallback and the injected head stacks up.
 */
const template = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!template.includes(`<div id="${ROOT_ID}"></div>`)) {
  // Almost always means dist already holds a previous prerender: the template has to be
  // the untouched vite output, so run a fresh build first.
  console.error(
    `✗ ${DIST}index.html is not a clean build shell — run ` +
      `\`npm run build --workspace=packages/${TARGET}\` first`,
  );
  process.exit(1);
}

let written = 0;
let failures = 0;
// Keyed per language, not globally: the home page's title is deliberately just SITE_TITLE
// in every language (see metaForRoute) — that's not a content mistake, so comparing across
// languages flagged en's "/" and ja's "/" as duplicates of each other on every single run.
// What this is actually meant to catch is two different pages ending up with the same
// title within one language, which per-language keys still do.
const seenTitles = new Map();

for (const route of routes) {
  const key = `${route.lang}:${route.title}`;
  if (seenTitles.has(key)) {
    console.warn(`! ${route.path} shares a title with ${seenTitles.get(key)}`);
  }
  seenTitles.set(key, route.path);
  if (!route.description) {
    console.error(`✗ ${route.path} has no description`);
    failures++;
  }

  await page.goto(`${origin}${BASE}${route.url.replace(/^\//, '')}`, { waitUntil: 'networkidle' });

  const root = await page.evaluate((id) => document.getElementById(id).innerHTML, ROOT_ID);

  /**
   * Fail the build rather than publish an empty shell. A route that renders nothing —
   * because a selector moved or the API stub stopped matching — would otherwise ship
   * silently and look exactly like the problem prerendering exists to solve.
   */
  const visible = root
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // /contact is a form, so it is legitimately short — labels and buttons only.
  if (visible.length < 80) {
    console.error(`✗ ${route.path} rendered only ${visible.length} chars of text`);
    failures++;
  }

  const html = template
    .replace('<html ', '<html data-prerendered ')
    .replace(/<html([^>]*)lang="[^"]*"/, `<html$1lang="${route.lang}"`)
    .replace(/<title>.*?<\/title>/s, head(route))
    .replace(`<div id="${ROOT_ID}"></div>`, `${contentScript}<div id="${ROOT_ID}">${root}</div>`);

  const out =
    route.url === '/' ? join(DIST, 'index.html') : join(DIST, route.url.slice(1), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  written++;
}

// ---- SPA fallback -----------------------------------------------------------
/**
 * Pages answers any unknown path with 404.html. It has to be the untouched build shell,
 * never a prerendered page: a copy of index.html here would carry the home page's markup
 * and its data-prerendered flag, so the client would try to hydrate a home page into
 * whatever the router actually matched, React would bail on the markup and log a hydration
 * error. An empty shell simply client-renders, which is right for a route that by
 * definition has nothing prerendered.
 */
writeFileSync(join(DIST, '404.html'), template);

// ---- sitemap + robots -------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map((r) => `  <url><loc>${canonical(r.url)}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync(
  join(DIST, 'robots.txt'),
  /**
   * Crawlers read robots.txt only from the domain root. On a Pages *project* site this
   * file is served from /<repo>/robots.txt and is therefore inert — it is written anyway
   * because it costs nothing and becomes live the moment the site moves to a custom domain
   * or a user-pages repo. Until then, submit the sitemap directly in Search Console.
   * /admin needs no Disallow to stay out of the index: it is the one route never
   * prerendered, so Pages answers it with a 404.
   */
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}${BASE}sitemap.xml\n`,
);

/**
 * Hydration gate.
 *
 * Writing correct-looking HTML is not enough: if the client's first render disagrees with
 * it by even one text node, React discards the whole thing and re-renders, which throws
 * away the Largest Contentful Paint candidate and undoes the entire point of prerendering.
 * Nothing visible breaks — the page still ends up correct — so this is invisible without a
 * check.
 *
 * The failure that motivated this: JSX of the form `text {expr} text` produces adjacent
 * text nodes. React's SSR separates them with <!-- --> comments; this prerenderer captures
 * innerHTML from a live DOM, where those separators do not exist. Hydration found one
 * merged text node where it expected several and bailed. Interpolate into a single
 * expression instead.
 */
const hydrationPage = await browser.newPage();

/**
 * The API answers with exactly what was embedded, which is the production case: the
 * prerenderer fetches the live content and ships it as __CONTENT__, so the client seeds
 * from the same data the API is about to return and there is nothing to swap to.
 */
await hydrationPage.route('**/api/content', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(live) }),
);
await hydrationPage.route('**static.cloudflareinsights.com/**', (r) => r.fulfill({ status: 204 }));

/**
 * Framework-specific mismatch detection — the two frameworks don't fail the same way, and
 * for Vue specifically, "fail" is the wrong word for what actually happens.
 *
 * React: a mismatch throws (as an uncaught page error carrying one of its minified error
 * codes) and React discards the whole prerendered subtree, rebuilding it from scratch —
 * the Largest Contentful Paint candidate goes with it even though nothing looks broken
 * afterwards. Gated below: any of these codes fails the build.
 *
 * Vue: hydrating a DOM-captured snapshot (rather than real markup from
 * @vue/server-renderer's renderToString, which this project deliberately doesn't run — see
 * the top of this file) structurally cannot supply the comment-node fragment markers Vue's
 * hydration algorithm expects for v-for/v-if/multi-root constructs, so it logs "Hydration
 * completed but contains mismatches." on essentially every real route, independent of
 * whether anything is actually wrong. Confirmed empirically (build packages/web-vue,
 * capture a route's rendered DOM, feed it back in as data-prerendered markup, watch the
 * console): Vue patches the mismatched nodes in place rather than discarding the subtree,
 * and the page's visible text never changes across the load — the checks further down
 * this loop (content embedded, text stays stable) are what actually catch a real problem
 * for this target, and are unaffected by any of this. So these are logged for visibility,
 * not gated.
 */
const mismatches = [];
if (isVue) {
  hydrationPage.on('console', (msg) => {
    if (msg.type() === 'error' && /hydration/i.test(msg.text())) mismatches.push(msg.text());
  });
} else {
  hydrationPage.on('pageerror', (e) => {
    const code = e.message.match(/Minified React error #(\d+)/)?.[1];
    // 418 hydration mismatch, 423 error while hydrating, 425 text content mismatch.
    if (code && ['418', '423', '425'].includes(code)) mismatches.push(code);
  });
}
for (const route of routes) {
  mismatches.length = 0;
  // Trailing slash, unlike the capture loop above. Each route is written as a directory
  // index, so requesting /about serves the SPA fallback — the home page's markup — and the
  // mismatch that produces is the harness's fault rather than the app's. /about/ is also
  // the form Pages answers with a 200, so this is what a visitor actually gets.
  const url = `${origin}${BASE}${route.url === '/' ? '' : `${route.url.slice(1)}/`}`;
  /**
   * Watches the visible text across the load, so a swap is caught as it happens rather
   * than inferred afterwards. Installed before navigating, because the change being looked
   * for lands within a few hundred milliseconds of the API answering.
   */
  await hydrationPage.addInitScript(() => {
    window.__seen = [];
    const tick = () => {
      const main = document.querySelector('#main');
      if (main) {
        const text = main.innerText.replace(/\s+/g, ' ').trim().slice(0, 400);
        if (window.__seen[window.__seen.length - 1] !== text) window.__seen.push(text);
      }
      if (performance.now() < 3500) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await hydrationPage.goto(url, { waitUntil: 'networkidle' });
  await hydrationPage.waitForTimeout(1200);

  /**
   * 1. The page must ship the content it was rendered from.
   *
   * The client seeds ContentContext from __CONTENT__, falling back to the bundled
   * SECTIONS. If the embedding breaks, that fallback silently takes over: the markup shows
   * one thing, the API returns another, and the text is replaced in front of the visitor a
   * moment after load. Nothing errors, so only a check like this notices.
   */
  const embedded = await hydrationPage.evaluate(() => window.__CONTENT__ ?? null);
  if (JSON.stringify(embedded) !== JSON.stringify(live)) {
    console.error(
      `✗ ${route.path} does not carry the content it was rendered from — the client will ` +
        'seed from the bundle instead and the text will change after load',
    );
    failures++;
  }

  /**
   * 2. The visible text must not change once the API has answered.
   *
   * This is the symptom the embedding exists to prevent, asserted directly rather than
   * through the mechanism, so it still holds if the mechanism is replaced.
   */
  const seen = await hydrationPage.evaluate(() => window.__seen ?? []);
  if (seen.length > 1) {
    console.error(
      `✗ ${route.path} rewrites its content after load (${seen.length} distinct renders) — ` +
        'the visitor sees the text change',
    );
    console.error(`    first: ${seen[0]?.slice(0, 90)}`);
    console.error(`    then:  ${seen[1]?.slice(0, 90)}`);
    failures++;
  }

  if (mismatches.length && !isVue) {
    console.error(
      `✗ ${route.path} fails to hydrate (React ${[...new Set(mismatches)].join(', ')}) — ` +
        'the prerendered markup is being thrown away. Look for `text {expr} text` in the JSX.',
    );
    failures++;
  } else if (mismatches.length) {
    // Not gated — see the comment above where `mismatches` is set up.
    console.warn(
      `! ${route.path} logged a Vue hydration mismatch (self-healed, see script comment)`,
    );
  }
}
if (!failures) {
  console.log(
    `✓ all ${routes.length} routes hydrate, carry their own content, and do not rewrite it after load`,
  );
}

await browser.close();
stop();

if (failures) {
  console.error(`✗ prerender produced ${failures} problem(s); not publishing this build`);
  process.exit(1);
}
console.log(
  `✓ prerendered ${written} routes across ${LANGS.length} languages, sitemap (${routes.length} urls) and robots.txt`,
);

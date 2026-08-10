#!/usr/bin/env node
/**
 * Prerender every public route to a static HTML file.
 *
 * GitHub Pages serves an SPA by falling back to 404.html, which means every URL except /
 * answers with an HTTP 404 status. Crawlers do not index 404s, and the ones that do run
 * JavaScript (essentially Googlebot, on a deferred second pass) were the only ones seeing
 * any content at all — everything else got `<div id="root"></div>`.
 *
 * Booting the built app in a real browser and writing out the resulting DOM fixes both:
 * each route becomes an ordinary file at its own path, so Pages returns 200, and the poem
 * text is in the markup before any script runs. The app still boots on top and takes over
 * with live API data, so admin edits are never more than one deploy from being reflected.
 *
 * Uses Playwright because it is already a dev dependency — no SSR runtime, no new
 * framework. Poems are fetched once from the live API and then served to the browser from
 * a route stub, the way e2e/fixtures.ts does it: the content stays current without every
 * one of the 37 page loads hitting Render, and a single fetch is the only thing that can
 * fail. If it does, the bundled poems are used and the fallback is logged.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { metaForRoute, POEMS, stripPageBreaks } from '@gedichtenv2/shared';
import { chromium } from '@playwright/test';

const SITE = process.env.SITE_URL ?? 'https://artoriun.github.io/kov-cs-poetry';
const BASE = '/kov-cs-poetry/';
const PORT = 4178;
const DIST = new URL('../packages/web/dist/', import.meta.url).pathname;
const WEB = new URL('../packages/web/', import.meta.url).pathname;

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Prefer the live API so a rebuild picks up anything edited in the admin portal. Falling
 * back to the bundled poems keeps a sleeping or broken Render instance from publishing an
 * empty site — but the fallback is announced, because silently shipping stale content is
 * the worse failure: visitors would see the edit (the app fetches at runtime) while every
 * crawler kept the old text, with nothing in the build log to explain why.
 */
async function loadPoems() {
  const api = (process.env.VITE_API_URL ?? '').replace(/^http:\/\//, 'https://');
  const bundled = POEMS.filter((p) => !p.deleted);
  if (!api) {
    console.warn('! VITE_API_URL not set — prerendering from bundled poems');
    return bundled;
  }
  try {
    const res = await fetch(`${api}/api/poems`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty or malformed response');
    console.log(`✓ prerendering from the live API (${data.length} poems)`);
    return data.filter((p) => !p.deleted);
  } catch (err) {
    console.warn(`! live API unreachable (${err.message}) — prerendering from bundled poems`);
    return bundled;
  }
}

const live = await loadPoems();

/**
 * Hydration compares the client's first render against this markup, and the client seeds
 * PoemsContext from the bundled POEMS. When the API returned something different — i.e.
 * a poem was edited in the admin portal — the two would disagree and React would throw
 * the prerendered DOM away, defeating the point. Shipping the exact poems used keeps them
 * in step. Identical data injects nothing, so the usual case costs no bytes.
 */
const bundledPoems = POEMS.filter((p) => !p.deleted);

/** Ignore differences that cannot change what is rendered: the API returns `customSlides:
 *  []` and `customSlidesEnabled: false` where the bundle simply omits them. */
const norm = (p) =>
  JSON.stringify({
    ...p,
    customSlides: p.customSlides?.length ? p.customSlides : undefined,
    customSlidesEnabled: p.customSlidesEnabled || undefined,
    featured: p.featured || undefined,
  });

const bundledById = new Map(bundledPoems.map((p) => [p.id, p]));
const changed = live.filter((p) => {
  const b = bundledById.get(p.id);
  return !b || norm(p) !== norm(b);
});
const orderChanged = live.map((p) => p.id).join() !== bundledPoems.map((p) => p.id).join();

// Send a patch, not the whole collection. Every poem is already in the JS bundle, so
// embedding all 34 again cost 25KB of duplicated text in each of the 37 pages and pushed
// first contentful paint out by more than a second. Order plus the handful of genuinely
// edited poems is a fraction of that.
const patch = changed.length || orderChanged ? { order: live.map((p) => p.id), changed } : null;
const poemsScript = patch
  ? `<script>window.__POEMS_PATCH__=${JSON.stringify(patch).replace(/</g, '\\u003c')}</script>`
  : '';
if (patch) {
  console.log(
    `  (embedding hydration patch: ${changed.length} edited poem(s)${orderChanged ? ' + order' : ''}, ${poemsScript.length} bytes)`,
  );
}

// Titles and descriptions come from the shared helper the running app also uses, so the
// prerendered <title> and the one useRouteMeta sets on navigation cannot drift apart.
const paths = ['/', '/poems', '/contact', '/privacy', ...live.map((p) => `/poems/${p.id}`)];
const routes = paths.map((path) => ({
  path,
  ...metaForRoute(path, live),
  poem: live.find((p) => `/poems/${p.id}` === path),
}));

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The URL that actually serves a 200. Pages writes each route as a directory index, so
 *  it 301s /poems/poem-5 to /poems/poem-5/; a canonical naming the redirecting form points
 *  crawlers at a hop instead of at the page. */
const canonical = (path) => `${SITE}${path === '/' ? '/' : `${path}/`}`;

// No <link rel="preload"> for the carousel slide image: measured at 176ms either way over
// three throttled runs. Prerendering already puts the <img> in the markup, so the
// browser's preload scanner finds it in the first bytes of HTML — as early as an explicit
// hint could.

/** Per-route head. Deliberately no <meta name="keywords">: ignored by every major engine
 *  since 2009. The indexable signal is the poem text now sitting in the body. */
function head(route) {
  const url = canonical(route.path);
  const image = route.poem?.image ?? live[0]?.image ?? '';
  const tags = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${route.poem ? 'article' : 'website'}" />`,
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:locale" content="hu_HU" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].filter(Boolean);

  if (route.poem) {
    // schema.org has no Poem type (schema.org/Poem 404s); CreativeWork carrying
    // genre: Poetry is the idiomatic fit.
    tags.push(
      `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        genre: 'Poetry',
        name: route.poem.title,
        headline: route.poem.title,
        inLanguage: 'hu',
        author: { '@type': 'Person', name: 'Kovács' },
        url,
        image: route.poem.image,
        // Stripped: structured data is the poem as a reader gets it, not as it is authored.
        text: stripPageBreaks(route.poem.overlay ?? ''),
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
// Tells the app it is being captured, so it skips work whose result depends on this
// viewport — chiefly poem pagination, which would otherwise bake a 1280x900 split into
// markup that has to hydrate on a phone. See packages/web/src/lib/prerendered.ts.
await page.addInitScript(() => {
  window.__PRERENDERING__ = true;
});
await page.route('**/api/poems', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(live) }),
);
await page.route('**res.cloudinary.com/**', (r) =>
  r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
);
// Stubbed rather than left to hit the real endpoint: unstubbed, every route on every build
// would fire a real Cloudflare Web Analytics beacon, polluting live visitor counts with
// prerender traffic.
await page.route('**static.cloudflareinsights.com/**', (r) => r.fulfill({ status: 204 }));

// Captured before anything is written. Output must be built from this rather than from
// the live DOM: the preview server serves out of the same dist we are writing into, so
// once index.html has the home page's tags, every later route is served that as the SPA
// fallback and the injected head stacks up. Taking only #root from the browser also
// leaves out the inline styles Motion parks on elements mid-animation.
const template = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!template.includes('<div id="root"></div>')) {
  // Almost always means dist already holds a previous prerender: the template has to be
  // the untouched vite output, so run a fresh build first.
  console.error('✗ dist/index.html is not a clean build shell — run `npm run build` first');
  process.exit(1);
}

let written = 0;
let failures = 0;
const seenTitles = new Map();
for (const route of routes) {
  // A warning, not a failure: two poems really are both called "Kaposszentbenedek", so
  // this is the poet's content rather than a bug. Duplicate titles do dilute search
  // results, but disambiguating them is an editorial decision.
  if (seenTitles.has(route.title)) {
    console.warn(`! ${route.path} shares a title with ${seenTitles.get(route.title)}`);
  }
  seenTitles.set(route.title, route.path);
  if (!route.description) {
    console.error(`✗ ${route.path} has no description`);
    failures++;
  }
  await page.goto(`${origin}${BASE}${route.path.replace(/^\//, '')}`, {
    waitUntil: 'networkidle',
  });
  // The reveal animations gate on image load; the stub resolves instantly, but Motion
  // still needs a frame or two to commit the text into the DOM.
  await page.waitForTimeout(900);

  const root = await page.evaluate(() => document.getElementById('root').innerHTML);

  // Fail the build rather than publish an empty shell. A route that renders nothing —
  // because a selector moved, an animation never settled, or the stub stopped matching —
  // would otherwise ship silently and look exactly like the problem prerendering exists
  // to solve.
  const visible = root
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (route.poem) {
    // Stronger than a length check: the page must contain this poem's own opening, so a
    // route rendering the wrong poem (or just the chrome) is caught too.
    // Stripped before comparing, or a poem whose author put a page break in its opening
    // lines would look absent from its own page and fail this check.
    const opening = stripPageBreaks(route.poem.overlay ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
    if (opening && !visible.includes(opening)) {
      console.error(`✗ ${route.path} does not contain its own poem text`);
      failures++;
    }
  } else if (visible.length < 100) {
    // /contact is a form, so it is legitimately short — 147 chars of labels and buttons.
    console.error(`✗ ${route.path} rendered only ${visible.length} chars of text`);
    failures++;
  }

  // Drop the page-load scrim from the captured markup and flag the document so App does
  // not render one either. It exists to cover the flat background while the parchment
  // image loads; here the page is already painted, so all it can do is hide it — and
  // React re-creating it on mount replays the fade from opacity 1, which reads as a flash
  // on mobile and left Lighthouse reporting NO_LCP.
  const body = root.replace(/<div class="page-load-scrim"[^>]*><\/div>/g, '');
  const html = template
    .replace('<html ', '<html data-prerendered ')
    .replace(/<title>.*?<\/title>/s, head(route))
    .replace('<div id="root"></div>', `${poemsScript}<div id="root">${body}</div>`);

  const out =
    route.path === '/' ? join(DIST, 'index.html') : join(DIST, route.path.slice(1), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  written++;
}

// ---- SPA fallback -----------------------------------------------------------
// Pages answers any unknown path with 404.html. It has to be the untouched build shell,
// never a prerendered page: CI used to copy index.html here after this script ran, so the
// fallback carried the home page's markup and its data-prerendered flag. The client then
// tried to hydrate a home page into whatever the router actually matched — NotFound — and
// React threw #418 and gave up on the markup. An empty shell simply client-renders, which
// is right for a route that by definition has nothing prerendered.
writeFileSync(join(DIST, '404.html'), template);

// ---- sitemap + robots -------------------------------------------------------
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map((r) => `  <url><loc>${canonical(r.path)}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync(
  join(DIST, 'robots.txt'),
  // Crawlers only read robots.txt from the domain root, and this is a project page, so
  // artoriun.github.io/robots.txt is what they fetch — not this file. It is written anyway
  // because it costs nothing and becomes live the moment the site moves to a custom domain
  // or a user-pages repo. Until then: /admin is not crawlable because it is the one route
  // that is never prerendered, so Pages answers it with a 404; and the sitemap has to be
  // submitted directly in Search Console rather than discovered through the line below.
  `User-agent: *\nAllow: /\nDisallow: /kov-cs-poetry/admin\n\nSitemap: ${SITE}/sitemap.xml\n`,
);

await browser.close();
stop();
if (failures) {
  console.error(`✗ prerender produced ${failures} problem(s); not publishing this build`);
  process.exit(1);
}
console.log(`✓ prerendered ${written} routes, sitemap (${routes.length} urls) and robots.txt`);

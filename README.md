# TurboHamstarter

<img src="docs/turboham.gif" alt="TurboHam, the pixel dwarf hamster mascot, swaying and twitching his nose before bolting off-screen and popping back up" width="180" align="right">

A **TurboRepo** starter for a prerendered portfolio site: **React**, **TypeScript**, **Vite**
and **Motion** on the front, an **Express** + **Firestore** admin portal behind it. Every
route is prerendered to static HTML and hydrated, so the content is indexable without
JavaScript. CI gates every deploy on lint, typecheck, API tests, unit tests, layout tests,
an accessibility sweep and a bundle budget — nothing publishes unless all of it passes.

Every service it touches has a free tier, so the running cost is a hamster-appropriate zero.

[![CI](https://github.com/Artoriun/turbohamstarter/actions/workflows/ci.yml/badge.svg)](https://github.com/Artoriun/turbohamstarter/actions/workflows/ci.yml)

**Live demo:** https://artoriun.github.io/turbohamstarter/

### Lighthouse

Measured against the live deploy above, not a local build — the same audit CI runs against
every push, gating accessibility, best-practices and SEO at 100. Performance is not gated
(see [Testing](#testing) for why) but it is not an accident either.

<img src="docs/lighthouse-mobile.png" alt="Lighthouse mobile: Performance 99, Accessibility 100, Best Practices 100, SEO 100" width="480"><br>
Mobile — LCP 1.9s, CLS 0, TBT 0ms

<img src="docs/lighthouse-desktop.png" alt="Lighthouse desktop: Performance 100, Accessibility 100, Best Practices 100, SEO 100" width="480"><br>
Desktop — LCP 0.4s, CLS 0, TBT 0ms

<br clear="right">

---

## Features

**Public site**
- Home, About, Contact and Privacy pages, all content-driven and editable without a code change
- Every route prerendered to its own `index.html` with its own `<title>`, description and canonical
- Two languages on real paths (`/` and `/ja/`), each with its own prerendered pages and `hreflang`
- Light/dark mode that persists, WCAG AA contrast, honours `prefers-reduced-motion`
- Page transitions and a staggered entrance, kept clear of the first paint so they never delay it
- Project carousel — a real section, placeable on any page like any other, not a component wired into one page's JSX: a multi-item sliding track showing as many cards as fit the viewport, auto-advancing with an infinite wrap, plus touch/pointer drag — one CSS transform on the whole row, built without an animation library so it survives being the first thing a prerendered page paints. Each slide gets its own `/projects/:id` write-up page
- Contact form delivered by email, with validation, a honeypot and per-IP rate limiting
- Images sized per device via Cloudinary; fonts self-hosted and subset to the glyphs actually used
- Optional Cloudflare Web Analytics — cookie-less, no consent banner, one token away. Unset, and no analytics script is injected at all: not even a stub request
- Error and not-found pages instead of a blank document
- TurboHam, who sways, twitches his nose every fifth cycle, bolts off-screen every fifteenth and falls asleep at twenty-five — the same sprite sheet also drives three desk illustrations on About/Contact/Privacy, not a separate copy of the animation

**Admin portal (`/admin`)** — password login + JWT auth
- Create, edit and delete sections; changes persist to Firestore and appear site-wide immediately
- Filter the list by page with one click (All / Home / About / …); a new section lands wherever you're filtered to, rather than picking a page from a dropdown per card
- Reorder with the ↑/↓ arrows — they move the same `order` field the public site sorts by, so what you see in the portal is what ships, not a separate list the site quietly ignores
- A carousel is its own kind of section: one card holding a list of slides, each with its own heading, write-up, image and translations — add or remove a slide without touching code, from the same card
- Upload images straight to Cloudinary, one per section or per slide
- Edit every language's copy side by side
- Profanity filter on the way in, on by default and checked on every slide too, its settings panel behind a code flag
- The footer is pinned as site chrome: always visible regardless of filter, no move controls, cannot be deleted

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React** + **TypeScript** + **Vite** | UI, type safety, build & dev server |
| **TurboRepo** + npm workspaces | Monorepo build orchestration |
| **React Router** | Client-side routing |
| **Motion** (`motion/react`) | Page transitions, loaded lazily |
| **Express** | Admin API (`packages/api`) |
| **Firebase Firestore** | Content overrides, display order, auth state |
| **Cloudinary** | Image upload & hosting |
| **JWT** | Admin authentication |
| **Resend** / **Nodemailer** | Contact-form delivery, SMTP as a local fallback |
| **Biome** | Linting & formatting |
| **Playwright** | Layout tests, the accessibility sweep, and the prerenderer |
| **axe-core** | WCAG rules, run inside the Playwright suite |

---

## Project Structure

```
.nvmrc                          # Node 22 — required, see Deployment
playwright.config.ts            # 3 viewport projects
render.yaml                     # API infrastructure as code
biome.json                      # lint + format config
docs/turboham.gif               # the mascot, built from the sprite sheet
e2e/
├── layout.spec.ts              # overflow, nav, forms, page transitions, landing entrance
├── a11y.spec.ts                # axe sweep, every page × every viewport × both themes
├── carousel.spec.ts            # drag-to-navigate, snap-back under the threshold, no overflow
└── fixtures.ts                 # API stubs and the shared PAGES list
scripts/
├── prerender.mjs               # static HTML per route + sitemap.xml + robots.txt + 3 gates
├── check-budgets.mjs           # bundle budget + untransformed-image guard
├── check-lighthouse.mjs        # a11y/SEO/best-practices thresholds on the built output
└── hash-password.mjs           # prints an ADMIN_PASSWORD_HASH
packages/
├── shared/src/index.ts         # Section & CarouselSlide types, bundled content, languages, SEO
│                               #   ← deliberately has no relative imports; see Rendering
├── api/src/                    # Express server (port 4000)
│   ├── index.ts                # app + /health and /health/deps
│   ├── loadEnv.ts              # .env resolved relative to the file, not the cwd
│   ├── firebaseAdmin.ts        # Proxy-based db, swappable for tests
│   ├── password.ts             # scrypt hash + plaintext fallback
│   ├── rateLimit.ts            # per-IP fixed window
│   ├── authState.ts            # login attempts + token epoch (Firestore)
│   ├── asyncHandler.ts         # Express 4 does not catch async rejections; this does
│   ├── testing/fakeStore.ts    # in-memory Firestore stand-in (not built)
│   ├── routes/                 # auth, contact, content, settings, clientErrors (+ *.test.ts)
│   └── middleware/requireAuth.ts
└── web/                        # Vite React app (port 3210)
    ├── public/projects/*.svg   # pixel-art placeholder slide images — see Managing Content
    └── src/
        ├── main.tsx            # hydrates prerendered pages, else createRoot
        ├── App.tsx             # Routes + providers (/admin is lazy-loaded)
        ├── assets/             # hamster-sprite.svg
        ├── context/            # ContentContext, ThemeContext
        ├── i18n/               # en.ts, ja.ts, LanguageProvider
        ├── lib/                # api, images (Cloudinary), projectAssets, prerendered, useRouteMeta
        ├── components/         # Header, Footer, TurboHam, ProjectCarousel, PageTransition, ErrorBoundary, …
        ├── pages/              # Home, About, Contact, Privacy, ProjectDetail, Admin, NotFound
        └── styles/global.css   # tokens, layout, and the mascot's 138-step keyframes
```

---

## Quick Start

```bash
npm install               # install dependencies
npm run dev               # web (:3210) + API (:4000)
npm run build             # production build
npm run typecheck         # tsc across all packages
npm run check             # Biome lint + format verification
npm run test:api          # API unit + route tests
npm run test:unit         # web + shared unit tests
npm run test:e2e          # Playwright layout tests + accessibility sweep
npm run prerender         # static HTML per route (needs a fresh build first)
npm run check:budgets     # bundle budget + untransformed-image guard
npm run check:lighthouse  # a11y/SEO/best-practices on the built output
npm run hash-password     # prints an ADMIN_PASSWORD_HASH
```

Vite proxies `/api` to the API in development, so no `VITE_API_URL` is needed locally.

The admin portal is at `/admin`. Set `ADMIN_PASSWORD` in `packages/api/.env` before you can
log in — there is no default, deliberately.

**Port already taken?** `WEB_PORT=3111 npm run dev` — the layout tests read the same
variable. The default is 3210 rather than 3000 on purpose: Playwright reuses an
already-running server at its configured port, and a stray dev server from another project
on 3000 will otherwise silently host your entire test suite.

---

## Make It Yours

The five things to change, in the order you will want to change them.

**1. Name it.** `SITE_TITLE`, `SITE_DESCRIPTION` and `SITE_AUTHOR` in
`packages/shared/src/index.ts` — these reach the `<title>`, the meta descriptions and the
footer. Then the `name` in the root `package.json`, and `BASE_PATH` / `SITE_URL` at the top
of `.github/workflows/ci.yml`.

**2. Write the content.** Either edit `SECTIONS` in `packages/shared/src/index.ts`, or run
the site and edit everything from `/admin`. See [Managing Content](#managing-content) for
which one wins.

**3. Recolour it.** The design tokens are at the top of
`packages/web/src/styles/global.css`, under `:root` for light and `html.dark-mode` for dark.
**Check the contrast ratio before changing a text colour** — the accessibility sweep will
fail the build otherwise, which is the point. See [Theming](#theming) for the two traps.

**4. Replace the mascot,** if you must. He is a 16-pose sprite sheet at
`packages/web/src/assets/hamster-sprite.svg`, driven by `@keyframes hamster-idle` in
`global.css`. Sizing is exactly 2× the 16×15 grid so every source pixel maps to a whole
device pixel; a fractional scale is what makes pixel art look soft. The three desk
illustrations (`HamsterCoding`/`HamsterWriting`/`HamsterLawyer`) share this same element and
animation rather than a second copy, so a new sprite reaches them automatically.

**5. Delete what you do not need.** The Privacy page, the profanity filter and the
client-error endpoint are each self-contained.

### Adding a page

1. Create `packages/web/src/pages/YourPage.tsx`.
2. Add a `<Route>` in `App.tsx`.
3. Add the path to `ROUTES` in `packages/shared/src/index.ts`.
4. Add a title and description case to `metaForRoute`, in the same file.

Step 3 is the one that matters: `ROUTES` is what the prerenderer walks, what the sitemap is
built from, and what the layout and accessibility suites iterate. Miss it and the page works
in dev, 404s in production, and no test says a word. Everything else derives from that one
list on purpose.

### Adding a language

1. Add its code to `LANGS` in `packages/shared/src/index.ts`.
2. Copy `packages/web/src/i18n/ja.ts`, translate the values, keep the `: Dictionary` annotation.
3. Add it to `LOCALES` in `packages/web/src/i18n/index.tsx`.
4. Add a `translations` entry to each section in `SECTIONS`.

Steps 1 and 3 are checked against each other by a `satisfies`, and the annotation in step 2
makes a missing key a type error — so a half-finished language fails `npm run typecheck`
rather than rendering blanks in production.

The default language is the first entry of `LANGS` and lives at the site root; every other
language gets a path prefix (`/ja/about`) and its own prerendered pages. **Not a query
string:** static hosting serves one file per path and ignores the query, so `?lang=ja` would
hand a Japanese visitor the English HTML.

---

## Testing

**Layout tests** (`npm run test:e2e`) run in Playwright across three viewports — desktop,
mobile portrait and landscape — because the regressions a site like this suffers are layout
ones at a particular size rather than engine differences. They assert on horizontal
overflow, content rendering past the footer, the nav reaching every page, the contact form
validating before it sends, dark mode persisting across a reload, the language switcher
changing visible copy, and both halves of the animation story: that a page change fades the
old page out before the new one in, and that a page arrived at directly animates in without
ever hiding its content. The API and images are stubbed, so the suite is deterministic and
needs no network.

**Carousel drag** (same command, `e2e/carousel.spec.ts`) simulates a real pointer drag —
`page.mouse.down`/`move`/`up`, not a single teleport — to check the three things a swipe
gesture can get wrong: a drag past the 50px threshold navigates, one under it snaps back
without changing the slide, and neither ever produces horizontal page overflow.

**Accessibility sweep** (same command, `e2e/a11y.spec.ts`) runs axe over every page, at
every viewport, in **both themes**. It exists because a Lighthouse audit checks one page at
one width: a failing contrast ratio on the language toggle shipped once because the audit
ran at a mobile width, where the toggle is behind the hamburger and never rendered.

**API tests** (`npm run test:api`) use Node's built-in runner via `tsx`; no test framework
is installed. They cover the contact endpoint (mail-header injection, honeypot handling,
length caps, address validation, per-IP rate limiting, and the response when no mail
transport is configured), the admin password in both its plaintext and scrypt forms and the
precedence between them, the rate limiter's cap and window expiry, the login flow including
the escalating delay after a failure, `requireAuth` against tokens that are expired, signed
with another key, missing the `admin` claim, forged with `alg:none` or issued before the
last `revoke-all`, and the client-error endpoint's truncation and per-IP capping.

`authState` resolves Firestore on first use rather than at import, so tests substitute an
in-memory stand-in. Tests and their helpers are excluded from the API's tsconfig and never
reach `dist`.

**Unit tests** (`npm run test:unit`) cover the shared content helpers — including
`allSlides`/`findSlide`, and that a carousel section sorting ahead of the hero does not
steal the page's meta description — the Cloudinary URL builder and the profanity matcher.

**Lighthouse audit** (`npm run check:lighthouse`) runs against the built, prerendered
output — accessibility, SEO and best-practices are gated at 100; performance is measured and
printed but never gated, since a shared CI runner's timings vary by more than the thing
being measured. It serves `dist` itself, mounted at `BASE_PATH`, so the audit sees the same
URLs GitHub Pages will, and points Lighthouse's Chrome launcher at Playwright's own Chromium
rather than provisioning a second browser.

**Dependency audit** (`npm audit`) currently reports a high-severity finding against
`react-router` (CSRF bypass in unstable RSC code paths — see
[GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)). This app never
imports React Router's RSC APIs — plain `BrowserRouter`/`Routes`/hooks only — so the
vulnerable code path is unreachable here. The real fix (`react-router@8.0.0`) drops
`react-router-dom` as a package and requires React 19 and Vite 7, a cascading framework
upgrade disproportionate to an advisory that doesn't apply to this app's actual usage, so
it's deliberately left unaddressed. Revisit if `react-router-dom` ever adopts RSC APIs here.

---

## Rendering & SEO

`scripts/prerender.mjs` runs after the build. It serves `dist`, drives the built app in
Playwright, and writes each route's DOM to its own `index.html` — per language — plus
`sitemap.xml`, `robots.txt`, `hreflang` links and font preloads. Content comes from the live
API so admin edits reach the static HTML, falling back to the bundled sections if it is
unreachable; the fallback is logged.

**Prerendered pages are hydrated, not re-rendered.** `createRoot` over existing markup
discards and rebuilds it, which loses the Largest Contentful Paint candidate. The
prerenderer therefore enforces three gates, and the build fails if any of them break:

| Gate | What it catches |
|---|---|
| **Hydration** | React discarding the markup. Most often caused by `text {expr} text` in JSX — adjacent text nodes that React's SSR separates with comment markers, which a DOM capture cannot reproduce. |
| **Content carried** | A route whose HTML arrives empty, waiting on JavaScript. |
| **Content stability** | Content that changes after load, which is a visible swap for the reader. |

One consequence worth knowing before you edit `packages/shared/src/index.ts`: **it must have
no relative imports.** The package ships raw TypeScript that Node type-strips, and Node's
ESM resolver requires explicit file extensions. An `export * from './profanity'` once killed
the prerenderer for two commits while the build stayed green.

`npm run check:budgets` gates the deploy: it caps the gzipped initial payload at 112 KB and
fails on any image URL reaching a `src`/`srcSet` without `optimizeUrl()`. Section copy is
bundled — it is the hydration seed — so long content costs real bytes against that budget.

---

## Internationalization

UI text lives in typed locale files (`packages/web/src/i18n/{en,ja}.ts`) behind a
`LanguageProvider` + `useT()` hook — no i18n dependency. Content text lives in the
`translations` field of each section, so the admin portal edits every language in one place.

Switching language is a **full navigation**, not a state change: each language has its own
prerendered HTML, and swapping the strings client-side would leave the markup, `<title>` and
meta description in the previous language.

The admin portal runs in the default language regardless of the public site's: a second
`LanguageProvider` wraps only `/admin` with `scoped`, so it does not rewrite the address bar.

---

## API

| Endpoint | Notes |
| --- | --- |
| `GET /health` | Liveness only, deliberately shallow — Render's health check points here. |
| `GET /health/deps` | Reads Firestore, returns 503 on failure. For uptime monitoring. |
| `GET /api/content` | Bundled sections with Firestore overrides merged on top. Falls back to the bundle with a 200 if Firestore is unreachable, because a visitor should see the site rather than an error. |
| `POST /api/content` | Creates a section on a page, optionally `kind: 'carousel'`. Requires auth. |
| `PUT /api/content/:id` | Edits a section, including its `order` and (for a carousel) its `slides`. Returns 422 with the offending words if the profanity filter refuses it — checked on every slide too. Requires auth. |
| `DELETE /api/content/:id` | Soft-deletes a section. Requires auth. |
| `POST /api/content/:id/image` | Uploads to Cloudinary. 10 MB cap, memory storage — Render's filesystem is ephemeral. Requires auth. |
| `GET` / `PUT /api/settings` | Site settings, including the profanity filter toggle. |
| `POST /api/contact` | Validates and length-caps every field, rejects newlines in those reaching mail headers, drops honeypot submissions, rate-limited per IP. Returns 503 if no mail transport is configured. |
| `POST /api/auth/login` | Rate-limited per IP and recorded in Firestore so the window survives restarts. Failures are delayed progressively. Constant-time password comparison. |
| `POST /api/auth/revoke-all` | Signs out every session. Tokens carry an epoch that `requireAuth` checks. Requires a valid token. |
| `POST /api/client-errors` | Records a browser error in the server log. Truncated, newlines collapsed, capped per IP. Always answers 204 — a page that is already broken should not be told its report failed. |

---

## Deployment

- **Frontend → GitHub Pages** via `.github/workflows/ci.yml` on push to `main`. The deploy job runs `needs: [verify, e2e]`, so nothing publishes unless every check passes.
- **Fast, on purpose.** Both jobs that need a browser cache `~/.cache/ms-playwright`, keyed on the installed Playwright version, so a normal run skips re-downloading ~300MB of Chromium binaries rather than fetching them fresh on every push.
- **Set two variables** at the top of `ci.yml` before your first deploy: `BASE_PATH` (`/<repo-name>/` for a project site, `/` for a user site or custom domain) and `SITE_URL`.
- **Rebuilt weekly** (cron, Mondays 04:00 UTC) and on demand via `workflow_dispatch`. Prerendered HTML is a snapshot, so admin edits are live for visitors immediately but reach crawlers only on a rebuild. `schedule` must stay in the deploy job's `if:`, or the weekly run builds and tests without deploying.
- **Pages-specific.** Vite builds with the base path and the router takes a matching `basename`. The prerenderer writes `404.html` from the *untouched* build shell, which Pages serves for `/admin` and unknown paths — it must not be a copy of the prerendered `index.html`, or the client tries to hydrate the home page into whatever the router matched. The generated `robots.txt` is inert on a project page, since crawlers read it from the domain root; on a custom domain it starts working.
- **Node 22 is required** (`.nvmrc`). The API imports raw TypeScript from `packages/shared`, which only loads on a runtime that strips types. On Node 20 the same command dies with `Unexpected token 'export'` pointing at `packages/shared`, with nothing to indicate the real cause.
- **API → Render** (free tier). Set `CORS_ORIGIN` (`https://<your-username>.github.io`) on Render, and add the deployed API URL as the `VITE_API_URL` GitHub Actions secret.
  - Build: `npm install && cd packages/api && npm run build` — Start: `node packages/api/dist/index.js`
  - `render.yaml` describes the infrastructure; reconcile it against the dashboard before applying it as a Blueprint.

**Running with no API at all is supported.** Leave `VITE_API_URL` unset and the site is a
pure static deploy: the content is in the bundle and the prerendered HTML, the portal is
simply unreachable, and the front end skips the content fetch rather than firing a request
that can only 404.

### Keeping the API awake

Render's free instances spin down after ~15 minutes idle, and the next visitor pays a 30–60
second cold start. Render's own health check does **not** prevent this. Point a free
UptimeRobot monitor at `https://<api-host>/health` every 5 minutes and the instance stays
up. This is the highest-value five minutes of setup in the whole stack — skip it and your
first visitor concludes the site is broken.

---

## Environment Variables

Create `packages/api/.env` for local development:

```env
# One of these two. ADMIN_PASSWORD_HASH wins when both are set; ADMIN_PASSWORD is the
# plaintext fallback and still works. Generate a hash for the same password with
# `npm run hash-password`, set it, confirm login, then delete the plaintext.
ADMIN_PASSWORD_HASH=scrypt$...$...
ADMIN_PASSWORD="your-password"

JWT_SECRET=your-jwt-secret
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com   # optional; nothing reads it today
CLOUDINARY_URL="cloudinary://api_key:api_secret@cloud_name"
CORS_ORIGIN=https://your-username.github.io        # required in production
HEALTH_DEPS_TIMEOUT_MS=5000   # optional; default 5000
PORT=4000                     # optional; default 4000

# Contact form. Resend (HTTPS) is required in production — Render's free instances
# block outbound ports 25/465/587.
RESEND_API_KEY=re_...
RESEND_FROM=onboarding@resend.dev   # optional; needs no domain verification

# SMTP fallback, used only when RESEND_API_KEY is unset. Omit both and
# POST /api/contact returns 503 rather than discarding messages.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=your-app-password
CONTACT_TO=you@example.com
```

For Gmail, `SMTP_PASS` must be an [App Password](https://myaccount.google.com/apppasswords)
with 2-Step Verification enabled. The same variables are declared in `render.yaml`.

For the Pages build, set `VITE_API_URL` as a repository secret and `VITE_DEFAULT_LANG` as a
repository variable. Without the former the site runs as a pure static deploy.

**Analytics is opt-in.** Add a site at [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)
(no domain migration needed — the "JS snippet" setup works for a GitHub Pages site) and copy
the token it gives you into `VITE_CF_BEACON_TOKEN`, set as a repository *variable* — it is
not a secret, since it ends up sitting in the page source either way. Leave it unset and
`index.html` never injects the script at all, not even a stub request.

**Firestore is optional to get started.** Without it the API serves the bundled content and
the portal cannot save, which is enough to develop against.

---

## Services, all free tier

| Service | Role | Limit worth knowing |
|---|---|---|
| **GitHub Pages** | Hosts the site | 100 GB/month soft bandwidth cap |
| **Render** | Runs the API | Sleeps after ~15 min idle; see *Keeping the API awake* |
| **Firebase Firestore** | Stores content edits | 50k reads/day, 20k writes/day |
| **Cloudinary** | Images | 25 credits/month |
| **Resend** | Contact-form email | 100 emails/day, 3k/month |
| **UptimeRobot** | Keeps Render awake | 50 monitors at 5-minute intervals |
| **Cloudflare Web Analytics** | Visitor analytics (optional) | Free, unlimited, no card |

None of them ask for a card. TurboHam approves: maximum storage, zero outlay.

---

## Operations

**Changing the admin password.** Run `npm run hash-password`, set the printed value as
`ADMIN_PASSWORD_HASH` on Render, confirm you can log in, then delete `ADMIN_PASSWORD`.
Existing sessions keep working — follow with a revoke if that is the point.

**If a token leaks**, call `revoke-all` while logged in. Every issued token stops working,
including the one you are using:

```bash
curl -X POST https://<api-host>/api/auth/revoke-all \
  -H "Authorization: Bearer <your-token>"
```

If you cannot log in at all, change `JWT_SECRET` on Render — same effect, but it restarts
the API. If repeated wrong passwords lock you out, the record is a document under the
`authAttempts` collection keyed by IP; delete it or wait for the window to pass.

**If the site shows old content after you edit `SECTIONS`,** the API process is stale. It
compiles the bundled sections in at startup and Firestore stores only the *difference* from
them, so a long-running API keeps serving what it booted with. `npm run dev` runs it under
`tsx watch` and restarts itself; a hand-started `tsx` will not.

**Errors.** Render's log is the record. The error boundary and the global handlers post to
`/api/client-errors`, which logs with a `[client]` prefix.

**If the site shows no content**, the API is unreachable. Visitors still see the bundled
sections and the prerendered pages; what is missing is anything edited since the last
deploy. Check `/health` and `/health/deps`.

**Publishing an admin edit to search engines.** Edits are live for visitors at once but
reach crawlers on the next build — weekly, or immediately via **Run workflow**.

**Known limits.** The API runs on Render's free tier: one instance, no SLA, sleeping when
idle unless pinged. The login rate limit fails open if Firestore is unreachable. The admin
token lives in `localStorage`; moving it to an `httpOnly` cookie needs the API and site to
share an origin, which this free-tier split does not.

---

## Scaling Notes

Free tiers by design (see above), but that's a cost choice, not a ceiling on the
architecture:

- **Reads scale for free.** Every route is prerendered static HTML served from GitHub
  Pages' CDN — visitor traffic never touches the API, Firestore or Cloudinary. Swapping in
  Cloudflare Pages/R2 removes the 100 GB/month cap with no code changes.
- **Writes are one instance.** The admin API is a single stateless (JWT) Render process, so
  horizontal scaling is mostly just adding instances — except the per-IP rate limiter and
  login-lockout counter live in that process's memory/Firestore state and would need a
  shared store (Redis) first, or each instance would enforce its own limit independently.
- **Firestore quotas track edits, not visitors.** The public site never reads Firestore
  directly, so the 50k reads/20k writes-a-day cap scales with admin activity, not traffic.
- **Content propagation, not requests, is the real latency.** Edits reach prerendered pages
  on the next build (weekly, or manual). Higher edit frequency would want a
  webhook-triggered rebuild instead of a cron.
- **Observability is grep-the-log today.** Fine at this scale; the next step is routing the
  existing error-boundary/`/api/client-errors` pipe into a real APM (Sentry, Datadog)
  instead of rewriting it.

---

## Managing Content

Sections live in `packages/shared/src/index.ts` as the bundled defaults; admin-portal edits
are stored in Firestore as **overrides on top of them**, and take precedence at runtime.
That layering is what keeps the site up when a free tier sleeps: the bundle is what renders
before the API answers, and what keeps rendering if it never does.

To add a bundled section, append to `SECTIONS`:

```typescript
{
  id: 'about-pricing',
  page: 'about',                    // 'home' | 'about' | 'footer'
  heading: 'What it costs',
  body: 'Nothing, which is rather the point.',
  order: 7,
  translations: { ja: { heading: '費用', body: '無料です。' } },
}
```

`page` groups sections onto a route, `order` sorts them within it — the admin portal's ↑/↓
arrows edit this same field, so the card you drag is the block that moves — and
`translations` holds the other languages, a missing one falling back to the base text rather
than rendering blank. `image` is optional and holds a Cloudinary URL.

In the portal itself, a page is chosen once, at creation: filter the list to the page you
want (**All / Home / About / …**) and press **Add section** — there is no per-card page
picker to revisit later. Existing content can still be re-ordered against its neighbours on
the same page at any time; it just cannot be moved to a *different* page without deleting and
re-adding it, which is a deliberate simplification rather than an oversight.

The **footer** is modelled as a page so it reuses the same editing and translation
machinery, but the portal treats it as site chrome: it is always visible regardless of which
filter is active, pinned below everything else, has no move controls, is not one of the
filter tabs, and cannot be deleted — with `footer` absent from the filter bar there would be
no way to recreate one from the portal.

### Carousel sections

A section can be `kind: 'carousel'` instead of a plain heading/body block. Its own
`heading`/`body` are never rendered on the site — `heading` is just this row's label in the
admin list — because the public site renders its `slides` instead:

```typescript
{
  id: 'home-carousel',
  page: 'home',
  kind: 'carousel',
  heading: 'Projects carousel',     // admin-only label, not shown publicly
  body: '',
  order: -1,                        // sorts ahead of the hero (order: 0) — top of the page
  slides: [
    {
      id: 'a-very-serious-undertaking',       // also its /projects/:id route
      heading: 'A Very Serious Undertaking',
      body: 'What it was, why it mattered, and what happened next.',
      translations: { ja: { heading: '大真面目な取り組み', body: '……' } },
    },
  ],
}
```

Each slide is its own overlay caption, write-up, optional `image` and `translations` — the
same four fields a plain section has, just one array level deeper — and gets its own
`/projects/:id` page for free, resolved by `findSlide()` scanning every carousel section's
slides. That lookup does not care which page hosts the carousel, so moving the whole
component to a different page (delete it under one filter, add it under another, or just
edit `page` in `SECTIONS`) never breaks a slide's URL.

Because it is a section like any other, it inherits `page` and `order`: put it on any page,
reorder it against its siblings, delete the whole thing — nothing about a carousel is
special-cased anywhere outside `ProjectCarousel.tsx` (which only ever receives the `slides`
array it is handed) and that one lookup. From the portal, press **Add carousel** instead of
**Add section**; it starts empty, and **Add slide** / **Delete slide** on the card itself
manage the array — nothing round-trips to the API until you press the card's own **Save**,
same as editing a heading.

The bundled default ships with three slides: fictional hamster-lore case studies rather than
lorem ipsum, so a fresh clone looks like a real portfolio mid-edit rather than an obviously
empty template. Their images are hand-drawn pixel art at `packages/web/public/projects/*.svg`
in the mascot's own palette, served from `public/` rather than imported — a few kilobytes of
SVG would otherwise be base64-inlined straight into the JS bundle, which costs more gzipped
than the file itself and counts against the budget above for no reason. Replace the slides
with your own projects, or delete the section outright.

**The profanity filter** is on by default and refuses saves containing anything on its list,
returning the offending words so the portal can say something more useful than "save
failed" — checked on a carousel's own slides too, not just a plain section's heading/body.
Its settings panel is hidden behind `SHOW_PROFANITY_SETTING` in
`packages/web/src/pages/Admin.tsx` — flip it to `true` to expose the toggle, or delete the
whole thing if a filter on your own writing seems excessive. TurboHam does not judge; he
hoards indiscriminately.

---

## Theming

Colours are CSS custom properties at the top of `packages/web/src/styles/global.css`
(`--bg`, `--text`, `--accent`, …). Light mode under `:root`, dark mode under
`html.dark-mode`.

Every text colour clears WCAG AA 4.5:1 against its background, and the accessibility sweep
fails the build if one stops doing so. Two things the ratio maths alone will not tell you:

- **`--accent` is not a text colour.** The brand green is 2.5:1 against the page — fine as a
  border, a focus ring or a background, nowhere near enough for words. Text uses
  `--accent-text`, the same hue darkened to 4.75:1. In dark mode the accent already passes,
  so the two are the same colour there.
- **Tinted surfaces move the target.** The language toggle's track sits at 7% ink, darker
  than the page, which is enough to drop a compliant muted grey to 4.19:1. Check a colour
  against what is actually behind it, not against `--bg`.

---

## Licence

**MIT — use it for anything, commercial included, as long as you credit the original.**

Concretely, the one obligation is that the copyright notice in [`LICENSE`](LICENSE) travels
with the code: keep the file in your repository, or reproduce the notice in your own licence
or credits. Beyond that you may use, copy, modify, merge, publish, distribute, sublicense
and sell it, and you owe nothing else — no fee, no share-alike, no obligation to open your
own source.

A link back is appreciated but not required. Hoarding is encouraged; passing it off as
entirely your own is not.

Note this covers the **starter**. Whatever you build on top — your copy, your writing, your
images — is yours, and this section is one of the things you should replace with your own
terms.

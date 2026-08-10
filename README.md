# Kovács — Modern Poetry Portfolio

Bilingual (Hungarian/English) poetry portfolio: **React**, **TypeScript**, **Vite** and **Motion** in a **TurboRepo** monorepo, with an **Express** + **Firestore** admin portal. Every route is prerendered to static HTML and hydrated, so the poems are indexable without JavaScript. CI gates every deploy on lint, typecheck, API tests, unit tests, layout tests and a bundle budget.

[![CI](https://github.com/Artoriun/kov-cs-poetry/actions/workflows/ci.yml/badge.svg)](https://github.com/Artoriun/kov-cs-poetry/actions/workflows/ci.yml)

**Live demo:** https://artoriun.github.io/kov-cs-poetry/

![The poems grid, with the table of contents and the reader's flush-left poem text](docs/screenshot-poems.jpg)

![The home page carousel](docs/screenshot-home.jpg)

### Lighthouse

Measured against the live deploy above, not a local build — the same audit CI runs against
every push, gating accessibility, best-practices and SEO at 100.

<img src="docs/lighthouse-mobile.png" alt="Lighthouse mobile: Performance 95, Accessibility 100, Best Practices 100, SEO 100" width="480"><br>
Mobile — LCP 2.7s, CLS 0, TBT 0ms

<img src="docs/lighthouse-desktop.png" alt="Lighthouse desktop: Performance 100, Accessibility 100, Best Practices 100, SEO 100" width="480"><br>
Desktop — LCP 0.6s, CLS 0.004, TBT 0ms

---

## Features

**Public site**
- Home carousel of featured poems — auto-advances by line count, swipeable, with mask-wipe text reveals
- Paginated poems grid with a scroll-tracking table of contents
- Full-screen poem reader — vertical swipe between pages, staggered line reveals, dedicated landscape layout
- Contact form delivered by email, with validation, a honeypot and per-IP rate limiting
- Light/dark mode, fully responsive, WCAG AA contrast, honours `prefers-reduced-motion`
- Prerendered pages carry their own title, description, canonical and structured data
- Images sized per device via Cloudinary; the body font is self-hosted
- Optional Cloudflare Web Analytics — cookie-less, no consent banner, one token away. Unset, and no analytics script is injected at all: not even a stub request
- Error and not-found pages instead of a blank document; `/privacy` covers the contact form

**Admin portal (`/admin`)** — password login + JWT auth
- Create, edit, delete and drag-to-reorder poems; changes persist to Firestore and appear site-wide immediately
- **List** view (edit cards) and **Order** view (drag-to-reorder grid, touch supported)
- Feature poems for the home carousel; upload images to Cloudinary
- **Page breaks** — type `\n` in the poem text to continue on a new page over the same background
- **Custom Slides** — manually split a poem into reader pages, pre-filled from the page breaks above, or from a layout measurement when there are none
- Sessions renew while the portal is in use and end with an explanation rather than a silent reload
- Runs in English by default, with an EN/HU switch affecting the portal only

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React** + **TypeScript** + **Vite** | UI, type safety, build & dev server |
| **TurboRepo** | Monorepo build orchestration |
| **React Router** | Client-side routing |
| **Motion** (`motion/react`) | Declarative animations |
| **Express** | Admin API (`packages/api`) |
| **Firebase Firestore** | Poem overrides, display order, auth state |
| **Cloudinary** | Image upload & hosting |
| **JWT** | Admin authentication |
| **Resend** / **Nodemailer** | Contact-form delivery, SMTP as a local fallback |
| **Biome** | Linting & formatting |
| **Playwright** | Layout tests, and the prerenderer |

---

## Project Structure

```
.nvmrc                          # Node 22 — required, see Deployment
playwright.config.ts            # 3 viewport projects
render.yaml                     # API infrastructure as code
e2e/                            # layout.spec.ts + API-stubbing fixtures
scripts/
├── prerender.mjs               # static HTML per route + sitemap.xml + robots.txt
├── check-budgets.mjs           # bundle budget + untransformed-image guard
├── check-lighthouse.mjs        # a11y/SEO/best-practices thresholds on the built output
├── backup-poems.mjs            # snapshot the live poems
├── build-icons.mjs             # PNG icons from favicon.svg
└── hash-password.mjs           # prints an ADMIN_PASSWORD_HASH
packages/
├── shared/src/index.ts         # Poem type, fallback data, per-route SEO metadata
├── api/src/                    # Express server (port 4000)
│   ├── index.ts                # app + /health and /health/deps
│   ├── loadEnv.ts              # .env resolved relative to the file, not the cwd
│   ├── firebaseAdmin.ts
│   ├── password.ts             # scrypt hash + plaintext fallback
│   ├── rateLimit.ts            # per-IP fixed window
│   ├── authState.ts            # login attempts + token epoch (Firestore)
│   ├── testing/                # in-memory Firestore stand-in (not built)
│   ├── routes/                 # auth.ts, contact.ts, poems.ts, clientErrors.ts (+ *.test.ts)
│   └── middleware/requireAuth.ts
└── web/                        # Vite React app (port 3000)
    └── src/
        ├── main.tsx            # hydrates prerendered pages, else createRoot
        ├── App.tsx             # Routes + PoemsProvider (/admin is lazy-loaded)
        ├── assets/fonts/       # self-hosted Esteban (OFL)
        ├── context/            # PoemsContext, ThemeContext
        ├── i18n/               # en.ts, hu.ts, LanguageProvider
        ├── lib/                # api, analytics, images (Cloudinary + srcset), prerendered, useRouteMeta
        ├── components/         # Header, PoemCarousel, ErrorBoundary, …
        ├── pages/              # Home, Poems, Admin, Contact, Privacy, NotFound
        └── styles/             # global.css, themes.css, admin.css
```

---

## Quick Start

```bash
npm install               # install dependencies
npm run dev               # web (:3000) + API (:4000)
npm run build             # production build
npm run typecheck         # tsc across all packages
npm run check             # Biome lint + format verification
npm run test:api          # API route tests
npm run test:unit         # web + shared unit tests
npm run test:e2e          # Playwright layout tests
npm run prerender         # static HTML per route (needs a fresh build first)
npm run check:budgets     # bundle budget + untransformed-image guard
npm run check:lighthouse  # a11y/SEO/best-practices on the built output
npm run hash-password     # prints an ADMIN_PASSWORD_HASH
npm run backup-poems      # writes the live poems to backups/ (--check to compare only)
npm run build-icons       # rasterises the PNG icons from favicon.svg
```

Vite proxies `/api` to the API in development.

---

## Testing

**Layout tests** (`npm run test:e2e`) run in Playwright across three viewports — desktop,
mobile portrait and landscape — because the regressions this project suffers are layout
ones at a particular size rather than engine differences. They assert on horizontal
overflow, content rendering past the footer, scroll position after a reload, poem text
clearing the navigation button, slide pagination keeping every line, and the table-of-
contents indicator drawing on a cold load. The API and images are stubbed, so the suite is
deterministic and needs no network.

**API tests** (`npm run test:api`) use Node's built-in runner via `tsx`; no test framework
is installed. They cover:

- **Contact endpoint** — mail-header injection, honeypot handling, length caps, address
  validation, per-IP rate limiting, and the response when no mail transport is configured.
- **Admin password** — the plaintext form, the scrypt hash, precedence between the two, and
  malformed input.
- **Rate limiter** — the cap, per-address isolation and window expiry.
- **Login flow** — correct and incorrect passwords, missing configuration, the per-IP limit,
  the escalating delay after a failure, and a success clearing the record.
- **`requireAuth`** — tokens that are expired, signed with another key, missing the `admin`
  claim, forged with `alg:none`, or issued before the last `revoke-all`.
- **Token refresh** — that it needs a valid token of its own, that it extends a live session,
  and that neither an expired nor a revoked token can refresh its way back in.
- **Client-error endpoint** — truncation, newline collapsing, per-IP capping and its
  refusal to report a failed report.

`authState` resolves Firestore on first use rather than at import, so tests substitute an
in-memory stand-in. Tests and their helpers are excluded from the API's tsconfig and never
reach `dist`.

**Unit tests** (`npm run test:unit`) cover the Cloudinary URL builder (`optimizeUrl`,
`fullBleedSrcSet`), the hydration patch merge (`mergePoemPatch`), the per-route SEO metadata
(`describePoem`, `metaForRoute`), the admin session token (expiry, and that a dead one is
cleared rather than sent), and the page-break marks — how a poem splits on them, that none
survives into anything a reader sees, and the rules tying them to the Custom Slides editor.

Note the runner's one constraint: `@gedichtenv2/shared` resolves as CommonJS here, so a test
under `packages/web` cannot import a *value* from it — only types, which are erased. Pure
logic that needs both belongs in `packages/shared`, which is why `overlayEdit` lives there
rather than beside the component that calls it. That package is deliberately one module — see
the comment above `PAGE_BREAK` for the resolution constraint that forces it.

**Lighthouse audit** (`npm run check:lighthouse`) runs against the built, prerendered
output — accessibility, SEO and best-practices are gated at 100; performance is measured and
printed but never gated, since a shared CI runner's timings vary by more than the thing
being measured. It serves `dist` itself, mounted at the site's GitHub Pages base, so the
audit sees the same URLs Pages will, and points Lighthouse's Chrome launcher at Playwright's
own Chromium rather than provisioning a second browser. In CI this step is
`continue-on-error`: a gate nobody has watched pass yet should not be able to block a deploy
on its own say-so.

---

## Rendering & SEO

`scripts/prerender.mjs` runs after the build. It serves `dist`, drives the built app in
Playwright, and writes each route's DOM to its own `index.html`, plus `sitemap.xml` and
`robots.txt`. Poems come from the live API so admin edits reach the static HTML, falling
back to the bundled poems if it is unreachable — the fallback is logged.

Each route returns 200 with the poem in the markup, its own `<title>`, description,
canonical and `CreativeWork` JSON-LD. There is deliberately no `<meta name="keywords">`.

**Prerendered pages are hydrated, not re-rendered.** `createRoot` over existing markup
discards and rebuilds it, which loses the Largest Contentful Paint candidate. Three things
keep the client's first render matching the markup — break any of them and hydration fails:

- Flags like `imageLoaded` and `revealed` initialise from `IS_PRERENDERED`, so the first
  render does not include a loading prompt the captured HTML lacks.
- Poem pagination is skipped while `IS_PRERENDERING`: it measures the viewport, so a poem
  split at one size cannot match the same poem hydrating at another. Leaving it unpaginated
  also puts the whole poem in the HTML rather than only the first slide.
- The prerenderer embeds a patch — display order plus any edited poems — because it renders
  from the API while the client seeds from the bundle.

`npm run check:budgets` gates the deploy: it caps the gzipped initial payload and fails on
any poem image URL reaching a `src`/`srcSet` without `optimizeUrl()`.

---

## Internationalization

UI text lives in typed locale files (`packages/web/src/i18n/{en,hu}.ts`) behind a
`LanguageProvider` + `useT()` hook — no i18n dependency. `hu.ts` is type-checked against the
`en` shape, so a missing key is a build error. Language comes from `?lang=`, defaulting to
Hungarian (`VITE_DEFAULT_LANG`) and not persisted.

The admin portal defaults to English while the public site stays Hungarian: a second
`LanguageProvider` wraps only `/admin` (`defaultLang="en" scoped`), so the two are
independent. Neither provider sets `document.title` — that is per-route, and `useRouteMeta`
owns it using the same shared helper the prerenderer uses. To add a string, add the key to
both locale files and use `t.<key>`.

---

## API

| Endpoint | Notes |
| --- | --- |
| `GET /health` | Liveness only, deliberately shallow — Render's health check points here. |
| `GET /health/deps` | Reads Firestore, returns 503 on failure. Cached 30s. For uptime monitoring. |
| `GET /api/poems` | Falls back to the bundled poems if Firestore is unreachable. |
| `POST /api/poems` | Creates a blank poem with placeholder text and image. Requires auth. |
| `PUT /api/poems/:id` | Edits title, overlay text, image, featured/deleted flags, and the custom-slides fields. Merges, so editing one field cannot blank the others. Requires auth. |
| `PUT /api/poems/order` | Writes the display order as a Firestore doc, read back by `GET /api/poems`. Requires auth. |
| `DELETE /api/poems/:id` | Hard delete. For a bundled poem this only removes the override, so it reverts to `POEMS`; a Firestore-only poem is removed outright. Requires auth. |
| `POST /api/poems/:id/image` | Uploads to Cloudinary. 10 MB cap, memory storage — Render's filesystem is ephemeral. Requires auth. |
| `POST /api/contact` | Validates and length-caps every field, rejects newlines in those reaching mail headers, drops honeypot submissions, 5/hour per IP. Returns 503 if no mail transport is configured. |
| `POST /api/auth/login` | 10 attempts per 15 minutes per IP, recorded in Firestore so the window survives restarts, with an in-memory limiter as backup. Failures are delayed progressively and logged. Constant-time password comparison. |
| `POST /api/client-errors` | Records a browser error in the server log. Anonymous, so the message and stack are truncated, newlines collapsed, and reports capped per IP. Always answers 204 — a page that is already broken should not be told its report failed. |
| `POST /api/auth/refresh` | Trades a live token for a fresh one, so an admin who keeps using the portal is never cut off mid-edit. Re-reads the epoch rather than copying the caller's, so a refresh cannot undo a `revoke-all`. Requires a valid token. |
| `POST /api/auth/revoke-all` | Signs out every session. Tokens carry an epoch that `requireAuth` checks. Requires a valid token. |

---

## Deployment

- **Frontend → GitHub Pages** via `.github/workflows/ci.yml` on push to `main`. The deploy job runs `needs: [verify, e2e]`, so nothing publishes unless every check passes.
- **Fast, on purpose.** Both jobs that need a browser cache `~/.cache/ms-playwright`, keyed on the installed Playwright version, so a normal run skips re-downloading ~300MB of Chromium binaries rather than fetching them fresh on every push.
- **Rebuilt weekly** (cron, Mondays 04:00 UTC) and on demand via `workflow_dispatch`. Prerendered HTML is a snapshot, so admin edits are live for visitors immediately but reach crawlers only on a rebuild. `schedule` must stay in the deploy job's `if:`, or the weekly run builds and tests without deploying.
- **Pages-specific.** Vite builds with `--base=/kov-cs-poetry/` and the router takes a matching `basename`. The prerenderer writes `404.html` from the *untouched* build shell, which Pages serves for `/admin` and unknown paths — it must not be a copy of the prerendered `index.html`, or the client tries to hydrate the home page into whatever the router matched. The generated `robots.txt` is inert on a project page, since crawlers read it from the domain root. On a host serving from a domain root, drop the base path and `robots.txt` starts working.
- **Node 22 is required** (`.nvmrc`). The API imports raw TypeScript from `packages/shared`, which only loads on a runtime that strips types.
- **API → Render** (free tier). Set `CORS_ORIGIN` (`https://<your-username>.github.io`) on Render, and add the deployed API URL as the `VITE_API_URL` GitHub Actions secret.
  - Build: `npm install && cd packages/api && npm run build` — Start: `node packages/api/dist/index.js`
  - `render.yaml` describes the infrastructure; reconcile it against the dashboard before applying it as a Blueprint.

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
HEALTH_DEPS_TIMEOUT_MS=5000   # optional; default 5000

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
CONTACT_TO=pjcr.dekeijzer@gmail.com   # optional; this is the default
```

For Gmail, `SMTP_PASS` must be an [App Password](https://myaccount.google.com/apppasswords) with 2-Step Verification enabled. The same variables are declared in `render.yaml`.

For the Pages build, set `VITE_API_URL` as a repository secret. Without it the frontend
skips the poems fetch rather than firing a request against its own static host that can
only 404 — see `HAS_API` in `packages/web/src/lib/api.ts`.

**Analytics is opt-in.** Add a site at [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)
(the "JS snippet" setup works for a GitHub Pages site, no domain migration needed) and copy
the token it gives you into `VITE_CF_BEACON_TOKEN`, set as a repository *variable* — it is
not a secret, since it ends up sitting in the page source either way. Leave it unset and no
analytics script is injected at all, not even a stub request.

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
`authAttempts` collection keyed by IP; delete it or wait 15 minutes.

**Backups.** The poems visitors see are Firestore overrides merged over the bundled
fallback, and that fallback drifts as soon as anything is edited in the portal — so losing
the Firestore project would quietly roll the site back to older text. The weekly rebuild
runs `npm run backup-poems` and keeps the result as a build artifact for 90 days
(Actions → the run → Artifacts). Run it locally any time; `--check` reports drift without
writing.

**Errors.** Render's log is the record. The error boundary and the global handlers post to
`/api/client-errors`, which logs with a `[client]` prefix.

**If the site shows no poems**, the API is unreachable. Visitors still see the bundled poems
and the prerendered pages; what is missing is anything edited since the last deploy. Check
`/health` and `/health/deps`.

**Publishing an admin edit to search engines.** Edits are live for visitors at once but
reach crawlers on the next build — weekly, or immediately via **Run workflow**.

**Known limits.** The API runs on Render's free tier: one instance, no SLA, sleeping when
idle unless pinged. The login rate limit fails open if Firestore is unreachable. The admin
token lives in `localStorage`; moving it to an `httpOnly` cookie needs the API and site to
share an origin.

---

## Managing Poems

Poems live in `packages/shared/src/index.ts` as a fallback; admin-portal edits (title, text,
image, order, featured, deletion) are stored in Firestore and take precedence at runtime.
Create and edit poems from the portal — no code changes required.

To add a fallback poem, append to `POEMS`:

```typescript
{ id: "poem-6", title: "Title", image: "https://res.cloudinary.com/.../image.jpg", overlay: "Line one\nLine two" }
```

`overlay` is newline-separated text shown over the image. Two optional Firestore-only fields
drive the custom-slides reader layout, written only by the admin portal: `customSlides`
(`string[]`) and `customSlidesEnabled` (`boolean`).

### Page breaks

Typing the two characters `\n` in a poem's text marks where it should carry on to a new page
over the same background. It is a plain part of `overlay`, so it needs no schema change and no
migration — a poem without one is a single section, exactly as before.

The reader treats each section as a break it will never merge across, and still subdivides one
further if it is too tall for the viewport, so a break can be added without any risk of the
text running off a phone screen. Custom Slides render verbatim instead, which is what a poem
gets once it has marks, since typing one turns them on.

Marks are stripped everywhere the poem is shown whole rather than paged — the grid, the
carousel, the meta description, the JSON-LD — by `stripPageBreaks` in
`packages/shared/src/index.ts`. Anything new that renders `overlay` directly needs the
same treatment, or the marker shows up as literal text.

In the portal the marks and the Custom Slides editor stay in step: the first mark opens the
editor on the split, later edits re-split it, and deleting the last mark closes it again. The
rules live in `overlayEdit`, in that same file, with the reasoning for each.

---

## Licence

The software is MIT. The poems, their text and the photographs are **not** — they remain
their author's and are included only so the site can be built. See `LICENSE`.

---

## Theming

Colours are CSS custom properties in `packages/web/src/styles/themes.css` (`--bg-primary`,
`--text-primary`, `--header-bg`, …). Light mode under `:root`, dark mode under
`html.dark-mode`.

Every text colour clears WCAG AA 4.5:1 against its background, and `--text-tertiary`
(`#737373` light, `#828282` dark) sits at the minimum that still passes — check the ratio
before changing any of them. Contrast maths on the variables is not the whole story: the
poem reader lays a dimming scrim over the viewport, so anything beneath it renders at 68%
brightness.

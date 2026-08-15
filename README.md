# TurboHamstarter

<img src="docs/turboham.gif" alt="TurboHam, the pixel dwarf hamster mascot in teal headphones, swaying and twitching his nose before bolting off-screen and popping back up" width="180" align="right">

A **TurboRepo** starter for a prerendered portfolio site: React, TypeScript and Vite on the
front, an Express + Firestore admin portal behind it. Every route is prerendered to static
HTML, so the content is indexable without JavaScript.

Every service it touches has a free tier, so the running cost is a hamster-appropriate zero.

[![CI](https://github.com/Artoriun/turbohamstarter/actions/workflows/ci.yml/badge.svg)](https://github.com/Artoriun/turbohamstarter/actions/workflows/ci.yml)

**Live demo:** https://artoriun.github.io/turbohamstarter/

<br clear="right">

> Prefer Vue? The same starter, same features:
> [turbohamstarter-vue](https://github.com/Artoriun/turbohamstarter-vue).

---

## Lighthouse

Measured against the live deploy. CI runs the same audit on every push and gates
accessibility, best practices and SEO at 100.

<img src="docs/lighthouse-mobile.png" alt="Lighthouse mobile: Performance 99, Accessibility 100, Best Practices 100, SEO 100" width="440"><br>
**Mobile** — LCP 1.9s · CLS 0 · TBT 0ms

<img src="docs/lighthouse-desktop.png" alt="Lighthouse desktop: Performance 100, Accessibility 100, Best Practices 100, SEO 100" width="440"><br>
**Desktop** — LCP 0.4s · CLS 0 · TBT 0ms

---

## Stack

| | |
| --- | --- |
| **Front end** | React, TypeScript, Vite, Motion |
| **Back end** | Express, Firestore |
| **Media** | Cloudinary |
| **Tooling** | TurboRepo, Biome, Playwright, Lighthouse |
| **Hosting** | GitHub Pages (site) · Render (API) |

Three workspaces: `packages/web`, `packages/api`, `packages/shared`.

---

## Quick start

```bash
npm install
npm run dev      # web + API, with /api proxied in development
```

The admin portal is at `/admin`. Set `ADMIN_PASSWORD` in `packages/api/.env` before you can
log in — there is no default, deliberately.

```bash
ADMIN_PASSWORD=          # or ADMIN_PASSWORD_HASH from `npm run hash-password`
JWT_SECRET=
FIREBASE_PROJECT_ID=     # plus CLIENT_EMAIL, PRIVATE_KEY, STORAGE_BUCKET
CLOUDINARY_URL=
RESEND_API_KEY=          # optional; the contact form 503s without a transport
```

Running with no API at all is supported: leave `VITE_API_URL` unset and the site is a pure
static deploy, with the content in the bundle and the portal unreachable.

### Scripts

```bash
npm run build            # production build
npm run prerender        # static HTML per route, sitemap and robots
npm run ci               # everything CI runs, in order
npm run test             # API and unit tests
npm run test:e2e         # Playwright layout tests and accessibility sweep
npm run check:budgets    # bundle budget and untransformed-image guard
npm run check:lighthouse # accessibility / SEO / best-practices gate
npm run hash-password    # prints an ADMIN_PASSWORD_HASH
```

---

## Make it yours

**1. Name it.** `SITE_TITLE`, `SITE_DESCRIPTION` and `SITE_AUTHOR` in
`packages/shared/src/index.ts` reach the `<title>`, the meta descriptions and the footer. Then
the `name` in the root `package.json`, and `BASE_PATH` / `SITE_URL` at the top of
`.github/workflows/ci.yml`.

**2. Write the content.** Either edit `SECTIONS` in `packages/shared/src/index.ts`, or run the
site and edit everything from `/admin`. Portal edits are stored in Firestore and take
precedence at runtime; `SECTIONS` is the fallback a fresh clone ships with.

**3. Recolour it.** Design tokens sit at the top of `packages/web/src/styles/global.css`,
under `:root` for light and `html.dark-mode` for dark. Check the contrast ratio before
changing a text colour — the accessibility sweep will fail the build otherwise, which is the
point.

**4. Replace the mascot,** if you must. He is a 16-pose sprite sheet at
`packages/web/src/assets/hamster-sprite.svg`, driven by `@keyframes hamster-idle`. Size him at
exactly 2× the 16×15 grid so every source pixel maps to a whole device pixel.

**5. Delete what you do not need.** The Privacy page, the profanity filter and the analytics
hook are each self-contained.

---

## Features

- **Prerendered** — one HTML file per route with its own title, description, canonical and
  structured data
- **Two languages** on real paths with their own prerendered pages and `hreflang`
- **Admin portal** — password login with JWT auth, image upload, and a reorderable project
  carousel with its own slide editor
- **Light and dark** themes, WCAG AA contrast, `prefers-reduced-motion` respected
- **Contact form** with a honeypot, server-side validation and per-IP rate limiting
- **Cookie-less analytics**, opt-in and compiled out entirely without a token
- Sitemap and `robots.txt` generated at build

---

## Testing

`npm run ci` runs the pipeline in CI's order: Biome, `tsc`, API and unit tests, Playwright
layout tests across four viewport and touch profiles, an axe accessibility sweep in both
themes, a gzipped bundle budget, a first-paint-versus-hydrated check, the suite again against
the built output, and Lighthouse.

---

## Services, all free tier

| Service | Role | Limit worth knowing |
|---|---|---|
| **GitHub Pages** | Hosts the site | 100 GB/month soft bandwidth cap |
| **Render** | Runs the API | Sleeps after ~15 min idle |
| **Firebase Firestore** | Stores content edits | 50k reads/day, 20k writes/day |
| **Cloudinary** | Images | 25 credits/month |
| **Resend** | Contact-form email | 100 emails/day, 3k/month |
| **UptimeRobot** | Keeps Render awake | 50 monitors at 5-minute intervals |

None of them ask for a card. TurboHam approves: maximum storage, zero outlay.

**Keep the API awake.** Render's free instances spin down after ~15 minutes idle and the next
visitor pays a 30–60 second cold start. Point a free UptimeRobot monitor at
`https://<api-host>/health` every 5 minutes. It is five minutes of setup and the single
biggest difference to how the site feels on a first visit.

---

## Deployment

- **Site → GitHub Pages** on push to `main`; the deploy job needs every check to pass first.
- **API → Render.** Set `CORS_ORIGIN` there, and add the API URL as the `VITE_API_URL` GitHub
  Actions secret. Build `npm install && cd packages/api && npm run build`, start
  `node packages/api/dist/index.js`.
- Set `BASE_PATH` (`/<repo-name>/` for a project site, `/` for a custom domain) and `SITE_URL`
  at the top of `ci.yml` before the first deploy.
- Prerendered HTML is a snapshot, so a weekly cron rebuild keeps crawlers current.
- **Node 22** is required (`.nvmrc`).

---

## Licence

MIT — see [LICENSE](LICENSE).

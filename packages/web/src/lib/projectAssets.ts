// Served from packages/web/public/projects/ rather than imported as modules: each is a few
// bytes under Vite's 4KB inline threshold, so importing them would base64-inline them
// straight into the JS entry chunk — costing more gzipped than the SVG's own text, and it is
// exactly the entry chunk npm run check:budgets caps. A public/ file is a separate request
// instead, outside that budget entirely.
const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

/**
 * Default illustrations for the bundled placeholder projects, keyed by section id.
 *
 * `shared` cannot reference these paths — it has no relative imports, see the note at the
 * top of that file — so `Section.image` is left unset for the bundled projects and this
 * fills the gap. An admin-uploaded image (a real `Section.image`) always wins over it; see
 * the call sites in ProjectCarousel.tsx and ProjectDetail.tsx.
 */
export const DEFAULT_PROJECT_IMAGES: Record<string, string> = {
  'project-bedding-uprising': `${base}/projects/bedding-uprising.svg`,
  'project-wheel-prophecy': `${base}/projects/wheel-prophecy.svg`,
  'project-cheek-pouch-ledger': `${base}/projects/cheek-pouch-ledger.svg`,
};

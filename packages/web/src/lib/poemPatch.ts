import type { Poem } from '@gedichtenv2/shared';

/** Injected by the prerenderer as `window.__POEMS_PATCH__`. See mergePoemPatch. */
export interface PoemPatch {
  order: string[];
  changed: Poem[];
}

/**
 * Rebuild the live poem list from the bundled poems plus the prerenderer's patch.
 *
 * The prerenderer renders from the live API, which drifts from the bundle as poems are
 * edited or reordered in the admin portal. Rather than inline the whole collection into
 * every page — 25KB already present in the bundle — it emits only the difference: the live
 * order, and any poem whose content genuinely changed. This reverses that.
 *
 * Hydration compares the client's first render against the prerendered markup, so this must
 * reproduce the prerenderer's list exactly; a mismatch makes React discard the server markup
 * and rebuild the DOM.
 *
 * Extracted from PoemsContext so it can be tested without pulling in React and the Vite-only
 * `import.meta.env` that the API client reads.
 */
export function mergePoemPatch(bundled: Poem[], patch?: PoemPatch): Poem[] {
  const live = bundled.filter((p) => !p.deleted);
  if (!patch) return live;
  const byId = new Map(live.map((p) => [p.id, p]));
  // A changed entry may be a poem the bundle has never seen, so this adds as well as replaces.
  for (const p of patch.changed) byId.set(p.id, p);
  // `order` is authoritative: anything it omits is dropped, and a poem deleted in the admin
  // portal after the bundle was built arrives via `changed` with deleted set.
  return patch.order.map((id) => byId.get(id)).filter((p): p is Poem => Boolean(p) && !p?.deleted);
}

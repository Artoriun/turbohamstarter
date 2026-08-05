/**
 * True when the document was written by scripts/prerender.mjs rather than served as the
 * empty SPA shell.
 *
 * Prerendered markup is the *settled* state — images loaded, reveal animations finished.
 * The client's first render normally starts from the *initial* state, so it renders things
 * the prerendered HTML does not contain (the carousel's loading prompt being the clearest
 * case). That is a structural difference, which makes React discard the markup and rebuild
 * it, taking every Largest Contentful Paint candidate with it.
 *
 * Components therefore initialise their "has this loaded yet" flags to true when this is
 * set, so the first client render matches what is already on screen.
 */
export const IS_PRERENDERED =
  typeof document !== 'undefined' && document.documentElement.hasAttribute('data-prerendered');

declare global {
  interface Window {
    __PRERENDERING__?: boolean;
  }
}

/**
 * True only inside the headless browser while scripts/prerender.mjs is capturing, set via
 * an init script before navigation. Distinct from IS_PRERENDERED, which is true later, in
 * the visitor's browser, when loading a page that capture produced.
 *
 * Used to suppress work whose result depends on the capture viewport — anything that
 * measures available height, so a layout computed at 1280x900 would not match the same page
 * hydrating on a phone.
 */
export const IS_PRERENDERING = typeof window !== 'undefined' && window.__PRERENDERING__ === true;

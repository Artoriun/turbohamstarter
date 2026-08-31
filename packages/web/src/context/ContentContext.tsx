import { SECTIONS, type Section } from '@hamstarter/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { apiGetContent, HAS_API } from '../lib/api';
import { IS_PRERENDERED } from '../lib/prerendered';

/**
 * Content, seeded from the bundle and refreshed from the API.
 *
 * Seeding from `SECTIONS` rather than an empty array is deliberate and load-bearing:
 *
 *   - Hydration compares the client's first render against the prerendered markup. An
 *     empty initial state renders a different tree, React discards the server HTML, and
 *     the Largest Contentful Paint candidate is thrown away with it.
 *   - Free tiers sleep. If the API never answers, the site still shows its content
 *     instead of nothing.
 *
 * The prerenderer renders from the live API, which drifts from the bundle as soon as
 * anything is edited in the portal, so it injects `__CONTENT__` describing what the
 * markup actually holds. The client starts from that when present.
 */
declare global {
  interface Window {
    __CONTENT__?: Section[];
  }
}

const SEED: Section[] =
  (typeof window !== 'undefined' && window.__CONTENT__) || SECTIONS.filter((s) => !s.deleted);

interface ContentValue {
  sections: Section[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ContentContext = createContext<ContentValue>({
  sections: SEED,
  loading: false,
  refresh: async () => {},
});

export function ContentProvider({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState<Section[]>(SEED);
  // Prerendered pages start settled: their markup is already build-time accurate, so
  // there is nothing to wait for and no reason to show a loading state.
  const [loading, setLoading] = useState(!IS_PRERENDERED);

  const refresh = useCallback(async () => {
    if (!HAS_API) return;
    try {
      setSections(await apiGetContent());
    } catch (err) {
      // Keep whatever we have. A failed refresh must not blank the page — but say why, or
      // the page silently shows stale content and nothing explains it.
      console.warn('[content] refresh failed, keeping the content already shown:', err);
    }
  }, []);

  useEffect(() => {
    // Static-only deployment: the bundled content is all there is, and it is already shown.
    if (!HAS_API) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const fresh = await apiGetContent();
        if (!cancelled) setSections(fresh);
      } catch (err) {
        console.warn('[content] falling back to the bundled content:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ContentContext.Provider value={{ sections, loading, refresh }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent(): ContentValue {
  return useContext(ContentContext);
}

/** Live sections for one page, in display order. */
export function usePageSections(page: Section['page']): Section[] {
  const { sections } = useContent();
  return sections
    .filter((s) => s.page === page && !s.deleted)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

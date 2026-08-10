import { POEMS, type Poem } from '@gedichtenv2/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { apiGetPoems, HAS_API } from '../lib/api';
import { mergePoemPatch, type PoemPatch } from '../lib/poemPatch';

// Initial state is the bundled poems rather than an empty array. Starting empty meant
// React blanked the prerendered HTML on mount and only repainted once the API answered,
// and left the site showing nothing at all whenever the API was unreachable. The API
// response replaces this the moment it lands, so admin edits stay authoritative.
//
// Hydration compares the client's first render against the prerendered markup, so both
// must start from the same poems. The prerenderer renders from the live API, which drifts
// from the bundle as poems are edited or reordered in the admin portal, so it injects a
// patch describing the difference — order plus any genuinely edited poems. Sending the
// whole collection instead would duplicate 25KB of text that is already in this bundle.
declare global {
  interface Window {
    __POEMS_PATCH__?: PoemPatch;
  }
}

const SEED = mergePoemPatch(
  POEMS,
  typeof window !== 'undefined' ? window.__POEMS_PATCH__ : undefined,
);

interface PoemsContextValue {
  poems: Poem[];
  loading: boolean;
  refreshPoems: () => Promise<void>;
}

const PoemsContext = createContext<PoemsContextValue>({
  poems: SEED,
  loading: false,
  refreshPoems: async () => {},
});

export function PoemsProvider({ children }: { children: ReactNode }) {
  const [poems, setPoems] = useState<Poem[]>(SEED);
  const [loading, setLoading] = useState(true);

  const refreshPoems = useCallback(async () => {
    try {
      const fresh = await apiGetPoems();
      setPoems(fresh);
    } catch {
      // keep current data on error
    }
  }, []);

  useEffect(() => {
    // Skip the request entirely rather than let it 404: a plain static deploy has no
    // VITE_API_URL and never will, so this would otherwise fire on every single page load.
    if (!HAS_API) {
      setLoading(false);
      return;
    }
    refreshPoems().finally(() => setLoading(false));
  }, [refreshPoems]);

  return (
    <PoemsContext.Provider value={{ poems, loading, refreshPoems }}>
      {children}
    </PoemsContext.Provider>
  );
}

export function usePoems() {
  return useContext(PoemsContext).poems;
}

export function usePoemsContext() {
  return useContext(PoemsContext);
}

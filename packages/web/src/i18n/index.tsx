import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { en } from './en';
import { hu } from './hu';

export type Lang = 'en' | 'hu';
export type Dict = typeof en;

const dicts: Record<Lang, Dict> = { en, hu };

// Deployed default is Hungarian; override at build time with VITE_DEFAULT_LANG if needed.
const DEFAULT_LANG: Lang = import.meta.env.VITE_DEFAULT_LANG === 'en' ? 'en' : 'hu';

// Language precedence: ?lang= query param (per-load override) → default (Hungarian).
// The choice is intentionally NOT persisted, so a refresh always returns to the
// default language unless ?lang= is present in the URL.
function resolveInitialLang(fallback: Lang = DEFAULT_LANG): Lang {
  const q = new URLSearchParams(window.location.search).get('lang');
  return q === 'en' || q === 'hu' ? q : fallback;
}

type LangContextValue = { lang: Lang; t: Dict; setLang: (l: Lang) => void };
const LangContext = createContext<LangContextValue>({
  lang: DEFAULT_LANG,
  t: dicts[DEFAULT_LANG],
  setLang: () => {},
});

export function LanguageProvider({
  children,
  defaultLang,
  scoped = false,
}: {
  children: ReactNode;
  /** Starting language when ?lang= is absent. Defaults to the site default (Hungarian). */
  defaultLang?: Lang;
  /**
   * Set on a nested provider covering part of the tree, such as the admin portal. Its
   * language is independent of the surrounding site, so switching inside it cannot change
   * the public pages, and leaving unmounts it and restores them.
   */
  scoped?: boolean;
}) {
  const [lang, setLangState] = useState<Lang>(() => resolveInitialLang(defaultLang));

  useEffect(() => {
    // Only the root provider owns these. A nested one must not touch them: React runs
    // child effects before parent ones, so on a direct page load the root would overwrite
    // whatever the nested provider had just set.
    if (scoped) return;
    document.documentElement.lang = lang;
    // document.title is deliberately not set here. The title is per-route, not
    // per-language, and setting it on mount overwrote the per-route title the prerenderer
    // had written into the HTML — so every crawler that runs JavaScript saw the generic
    // site title on all 34 poems. useRouteMeta owns it now, via the same shared helper
    // the prerenderer uses, so the two cannot drift apart.
  }, [lang, scoped]);

  // Session-only switch (not persisted); a refresh reverts to the default language.
  const setLang = (l: Lang) => {
    setLangState(l);
  };

  return (
    <LangContext.Provider value={{ lang, t: dicts[lang], setLang }}>
      {children}
    </LangContext.Provider>
  );
}

// Returns the active language's dictionary, e.g. const t = useT(); t.nav.home
export function useT(): Dict {
  return useContext(LangContext).t;
}

// Full context when the current language or a setter is needed (e.g. a language switch).
export function useLang(): LangContextValue {
  return useContext(LangContext);
}

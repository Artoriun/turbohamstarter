import { DEFAULT_LANG, LANGS, type Lang } from '@hamstarter/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type Dictionary, en } from './en';
import { ja } from './ja';

/**
 * Translations without an i18n dependency.
 *
 * ── Adding a language ──────────────────────────────────────────────────────
 *   1. Add its code to LANGS in packages/shared.
 *   2. Copy `ja.ts`, translate the values, keep the `: Dictionary` annotation.
 *   3. Add it to LOCALES below.
 * Steps 1 and 3 are checked against each other by the `satisfies` on LOCALES, and the
 * annotation in step 2 makes a missing key a type error — so a half-finished language
 * fails `npm run typecheck` rather than rendering blanks in production.
 *
 * The default language is the first entry of LANGS and lives at the site root; every other
 * language gets a path prefix and its own prerendered pages.
 */
/**
 * The dictionaries. LANGS lives in the shared package because the prerenderer needs the
 * list too, and this `satisfies` is what keeps the two from drifting: adding a language
 * there without adding a dictionary here is a type error.
 */
export const LOCALES = { en, ja } satisfies Record<Lang, Dictionary>;

/**
 * The language is read from the path — /ja/about — not from a query or from
 * navigator.language.
 *
 * Both alternatives break prerendering. Static hosting serves one file per path and
 * ignores the query, so ?lang=ja would hand a Japanese visitor the English HTML; guessing
 * from the browser does the same thing non-deterministically. Either way the client's
 * first render disagrees with the markup, React discards it, and the Largest Contentful
 * Paint candidate goes with it. A path prefix has its own prerendered file, so the first
 * render matches.
 */
export function resolveLang(pathname = ''): Lang {
  const match = pathname.match(new RegExp(`(?:^|/)(${LANGS.join('|')})(?=/|$)`));
  return (match?.[1] as Lang) ?? DEFAULT_LANG;
}

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({
  children,
  defaultLang,
  /** Scoped providers (the admin portal) must not rewrite the address bar. */
  scoped = false,
}: {
  children: ReactNode;
  defaultLang?: Lang;
  scoped?: boolean;
}) {
  const [lang, setLangState] = useState<Lang>(
    () => defaultLang ?? resolveLang(typeof window === 'undefined' ? '' : window.location.pathname),
  );

  /**
   * Switching language is a full navigation, not a state change.
   *
   * Each language has its own prerendered HTML, and the point of that is for the browser to
   * receive the right one. Swapping the strings client-side would leave the markup, the
   * <title> and the meta description in the previous language until something re-rendered
   * them, and would skip the other language's prerendered page entirely.
   */
  const setLang = useCallback(
    (next: Lang) => {
      if (scoped || typeof window === 'undefined') {
        setLangState(next);
        return;
      }
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const rest = window.location.pathname
        .replace(base, '')
        .replace(new RegExp(`^/(${LANGS.join('|')})(?=/|$)`), '');
      const prefix = next === DEFAULT_LANG ? '' : `/${next}`;
      window.location.assign(`${base}${prefix}${rest || '/'}`);
    },
    [scoped],
  );

  // Keep <html lang> in step with the active language. Screen readers choose pronunciation
  // from it and search engines read it as the page's language, so Japanese text served
  // under lang="en" is announced with English phonetics and indexed as English.
  //
  // Skipped when scoped: a scoped provider only controls its own subtree's strings (the
  // admin portal's own UI), not the document's actual language — the surrounding chrome
  // (Header, Footer) still reads from the unscoped, site-wide provider and is genuinely in
  // whatever language the URL says. Letting a nested scoped instance overwrite <html lang>
  // would make it disagree with content that's still visibly on screen in the other one.
  useEffect(() => {
    if (scoped || typeof document === 'undefined') return;
    document.documentElement.lang = lang;
  }, [lang, scoped]);

  const value = useMemo<LanguageValue>(
    () => ({ lang, setLang, t: LOCALES[lang] }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguageContext(): LanguageValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used inside a LanguageProvider');
  return ctx;
}

/** The strings for the active language. */
export function useT(): Dictionary {
  return useLanguageContext().t;
}

/** The active language and a setter, for the switcher. */
export function useLang(): { lang: Lang; setLang: (lang: Lang) => void } {
  const { lang, setLang } = useLanguageContext();
  return { lang, setLang };
}

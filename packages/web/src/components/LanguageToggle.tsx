import { LANGS, type Lang } from '@hamstarter/shared';
import { LOCALES, useLang } from '../i18n';

/**
 * Language switcher. Renders nothing when only one locale is registered, so a site that
 * does not need translations carries no dead control.
 */
export function LanguageToggle() {
  const { lang, setLang } = useLang();
  if (LANGS.length < 2) return null;

  return (
    <nav className="lang-toggle" aria-label={LOCALES[lang].language.label}>
      {LANGS.map((code: Lang) => (
        <button
          key={code}
          type="button"
          className={`lang-btn${code === lang ? ' is-active' : ''}`}
          // aria-pressed rather than aria-current: this is a toggle, not navigation.
          aria-pressed={code === lang}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
          {/* Single interpolation — see the note in Footer.tsx. */}
          <span className="visually-hidden">{` — ${LOCALES[code].label}`}</span>
        </button>
      ))}
    </nav>
  );
}

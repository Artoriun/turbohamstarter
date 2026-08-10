import { type Lang, useLang } from '../i18n';

const OPTIONS: Lang[] = ['en', 'hu'];

/**
 * Language switch for the admin portal. It reads the scoped provider that wraps the
 * /admin route, so switching here changes only the portal — the public site keeps its
 * own language. Labels are the language codes themselves, so they need no translating.
 */
export default function AdminLangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="admin-lang-row">
      <fieldset className="admin-lang-toggle">
        <legend className="admin-lang-legend">Admin language</legend>
        {OPTIONS.map((code) => (
          <button
            key={code}
            type="button"
            className={`admin-lang-btn${lang === code ? ' is-active' : ''}`}
            aria-pressed={lang === code}
            onClick={() => setLang(code)}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

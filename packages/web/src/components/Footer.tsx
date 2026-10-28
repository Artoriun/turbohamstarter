import { localise } from '@hamstarter/shared';
import { Link } from 'react-router-dom';
import { usePageSections } from '../context/ContentContext';
import { useLang, useT } from '../i18n';

export function Footer() {
  const t = useT();
  const { lang } = useLang();
  // Editable from the admin portal like any other content. The bundled section supplies
  // the default, so this never renders empty even before the API answers.
  const section = usePageSections('footer')[0];
  const text = section ? localise(section, lang).body : undefined;

  return (
    <footer className="site-footer">
      {/* One expression, never `text {expr} text` — adjacent text nodes break hydration
          under this project's DOM-capture prerendering. See the prerender gate. */}
      <p>{text ?? `© ${new Date().getFullYear()} ${t.footer.rights}`}</p>
      <Link to="/privacy">{t.footer.privacy}</Link>
    </footer>
  );
}

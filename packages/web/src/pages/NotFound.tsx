import { Link } from 'react-router-dom';
import { useT } from '../i18n';

/**
 * Shown for any path that matches no route. Without it an unknown URL rendered nothing at
 * all — a blank page under the header, indistinguishable from a broken site. Pages already
 * serves 404.html for unknown paths, but that only boots the SPA; the router still needed
 * somewhere to send them.
 */
export default function NotFound() {
  const t = useT();
  return (
    <div className="page error-page">
      <h1>{t.notFound.title}</h1>
      <p className="error-body">{t.notFound.body}</p>
      <div className="error-actions">
        <Link className="btn-submit btn-link" to="/poems">
          {t.notFound.poems}
        </Link>
        <Link className="btn-submit btn-link" to="/">
          {t.notFound.home}
        </Link>
      </div>
    </div>
  );
}

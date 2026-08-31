import { Link } from 'react-router-dom';
import { useT } from '../i18n';

/**
 * What ErrorBoundary shows in place of a crashed tree. Split out as its own component so
 * it can use the translation hook — an error boundary has to be a class, which cannot.
 */
export default function AppErrorFallback({ retry }: { retry: () => void }) {
  const t = useT();
  return (
    <div className="page error-page" role="alert">
      <h1>{t.error.title}</h1>
      <p>{t.error.body}</p>
      <div className="error-actions">
        <button type="button" className="btn btn-primary" onClick={retry}>
          {t.error.reload}
        </button>
        <Link className="btn" to="/">
          {t.error.home}
        </Link>
      </div>
    </div>
  );
}

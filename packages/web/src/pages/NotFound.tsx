import { Link } from 'react-router-dom';
import { useT } from '../i18n';

export default function NotFound() {
  const t = useT();
  return (
    <div className="page prose">
      <h1>{t.notFound.title}</h1>
      <p>{t.notFound.body}</p>
      <Link className="btn btn-primary" to="/">
        {t.notFound.back}
      </Link>
    </div>
  );
}

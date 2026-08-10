import { Link } from 'react-router-dom';
import { useT } from '../i18n';

export default function Footer() {
  const t = useT();
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p>
          <a
            className="footer-copyright-link"
            href="https://github.com/Artoriun"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.footer.copyright}
          </a>
          {' · '}
          <Link className="footer-copyright-link" to="/privacy">
            {t.privacy.title}
          </Link>
        </p>
        <a href="#top" className="back-to-top">
          {t.footer.backToTop}
        </a>
      </div>
    </footer>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useT } from '../i18n';
import ThemeToggle from './ThemeToggle';

export default function Header({ onLogout }: { onLogout?: () => void } = {}) {
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty(
        '--header-height',
        `${el.getBoundingClientRect().height}px`,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [mobileOpen]);

  return (
    <header ref={headerRef} className="site-header">
      <div className="header-inner">
        <Link
          to="/"
          className="logo"
          onClick={() => {
            setMobileOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          Kovács
        </Link>
        <p className="subtitle">{t.header.subtitle}</p>

        <nav className={`main-nav ${mobileOpen ? 'open' : ''}`}>
          <ul>
            <li>
              <NavLink
                to="/"
                end
                onClick={() => {
                  setMobileOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {t.nav.home}
              </NavLink>
            </li>
            <li>
              <NavLink to="/poems" onClick={() => setMobileOpen(false)}>
                {t.nav.poems}
              </NavLink>
            </li>
            <li>
              <NavLink to="/contact" onClick={() => setMobileOpen(false)}>
                {t.nav.contact}
              </NavLink>
            </li>
            <li className="nav-login-mobile">
              {onLogout ? (
                <button
                  type="button"
                  className="nav-logout-btn"
                  onClick={() => {
                    setMobileOpen(false);
                    onLogout();
                  }}
                >
                  {t.nav.logout}
                </button>
              ) : (
                <NavLink to="/admin" onClick={() => setMobileOpen(false)}>
                  {t.nav.admin}
                </NavLink>
              )}
            </li>
          </ul>
        </nav>

        {onLogout ? (
          <button type="button" className="header-login-btn" onClick={onLogout}>
            {t.nav.logout}
          </button>
        ) : (
          <Link to="/admin" className="header-login-btn">
            {t.nav.admin}
          </Link>
        )}
        <ThemeToggle />

        <button
          type="button"
          className={`hamburger ${mobileOpen ? 'open' : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t.header.menu}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

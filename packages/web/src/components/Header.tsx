import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useT } from '../i18n';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { TurboHam } from './TurboHam';

export function Header() {
  const t = useT();
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/', label: t.nav.home, end: true },
    { to: '/about', label: t.nav.about },
    { to: '/contact', label: t.nav.contact },
  ];

  return (
    <header className="site-header">
      {/* First focusable element on the page, so a keyboard user can jump the nav. */}
      <a className="skip-link" href="#main">
        {t.nav.skipToContent}
      </a>

      <div className="header-inner">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <TurboHam className="brand-mascot" />
          {/* Two spans, no literal text between them — `Turbo{expr}` style adjacency is
              what breaks hydration under DOM-capture prerendering. */}
          <span className="brand-word">
            <span className="brand-turbo">Turbo</span>
            <span className="brand-ham">Hamstarter</span>
          </span>
        </NavLink>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          aria-label={t.nav.menu}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>

        <nav id="site-nav" className={`site-nav${open ? ' is-open' : ''}`}>
          {links.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
          <div className="header-controls">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}

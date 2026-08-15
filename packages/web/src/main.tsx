import { DEFAULT_LANG } from '@hamstarter/shared';
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppErrorFallback from './components/AppErrorFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, resolveLang } from './i18n';
import { loadAnalytics } from './lib/analytics';
import { installGlobalErrorReporting } from './lib/reportError';
// The @font-face rules live in global.css rather than coming from Fontsource's stylesheet,
// so the display strategy and the subsets are ours to choose. See the comment there.
import './styles/global.css';

/**
 * The language prefix is part of the basename rather than a route segment.
 *
 * That way every <Link to="/about"> keeps working untouched and resolves to /ja/about on
 * the Japanese pages — no route table has to know about languages, and no link can forget
 * to carry the prefix.
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const lang = resolveLang(window.location.pathname);
const basename = `${base}${lang === DEFAULT_LANG ? '' : `/${lang}`}` || '/';

// Installed before anything renders, so an error thrown during startup is still reported.
installGlobalErrorReporting();
loadAnalytics();

const tree = (
  <React.StrictMode>
    {/* reducedMotion="user" makes every Motion animation respect the OS setting: transform
        and opacity tweens are skipped and the element jumps to its end state. The CSS
        keyframes are handled separately by the prefers-reduced-motion block in
        global.css — the two systems need telling independently. */}
    {/* LazyMotion + the `m` components ship only the DOM animation features, which is
        ~22KB gzipped against ~40KB for the full `motion` bundle — a third of this app's
        entire payload for a fade. `strict` makes importing `motion` (rather than `m`)
        throw, so the saving cannot be undone by accident later. */}
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <LanguageProvider>
          <ThemeProvider>
            <BrowserRouter basename={basename}>
              {/* Inside the router so the fallback can link home, and inside the providers so
              it can be translated. It renders no wrapper element, so hydration of the
              prerendered markup is unaffected. */}
              <ErrorBoundary fallback={(retry) => <AppErrorFallback retry={retry} />}>
                <App />
              </ErrorBoundary>
            </BrowserRouter>
          </ThemeProvider>
        </LanguageProvider>
      </MotionConfig>
    </LazyMotion>
  </React.StrictMode>
);

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

// Prerendered routes are hydrated rather than re-rendered. createRoot over existing markup
// throws all of it away and rebuilds, which discards every element the browser had
// nominated for Largest Contentful Paint — the metric then reports nothing at all and the
// performance score goes null rather than merely low. Hydration adopts the existing nodes.
if (document.documentElement.hasAttribute('data-prerendered')) {
  ReactDOM.hydrateRoot(container, tree);
} else {
  ReactDOM.createRoot(container).render(tree);
}

import { MotionConfig } from 'motion/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppErrorFallback from './components/AppErrorFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './i18n';
import { loadAnalytics } from './lib/analytics';
import { installGlobalErrorReporting } from './lib/reportError';
import './styles/global.css';

const baseUrl = import.meta.env.PROD ? '/kov-cs-poetry' : '/';

// Installed before anything renders, so an error thrown during startup is still reported.
installGlobalErrorReporting();
loadAnalytics();

// Browsers restore the previous scroll offset on reload, so a refresh resumed part-way
// down the page instead of at the top. Opt out and land at the top every time.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
}

const tree = (
  <React.StrictMode>
    {/* reducedMotion="user" makes every Motion animation respect the OS setting: transform
        and opacity tweens are skipped and the element jumps to its end state. The CSS
        keyframes are handled separately by a prefers-reduced-motion block in global.css. */}
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <ThemeProvider>
          <BrowserRouter basename={baseUrl}>
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
  </React.StrictMode>
);

const container = document.getElementById('root')!;

// Prerendered routes are hydrated rather than re-rendered. createRoot over existing markup
// throws all of it away and rebuilds, which removes every element Chrome had nominated for
// Largest Contentful Paint; the trace showed six `largestContentfulPaint::Invalidate`
// events and, on a third of mobile runs, no surviving candidate at all — reported as
// NO_LCP. Hydration adopts the existing nodes, so nothing is removed.
if (document.documentElement.hasAttribute('data-prerendered')) {
  ReactDOM.hydrateRoot(container, tree);
} else {
  ReactDOM.createRoot(container).render(tree);
}

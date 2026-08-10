import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { PoemsProvider } from './context/PoemsContext';
import { LanguageProvider } from './i18n';
import { useRouteMeta } from './lib/useRouteMeta';
import Contact from './pages/Contact';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import Poems from './pages/Poems';
import Privacy from './pages/Privacy';

// Split out of the main bundle: the portal and its stylesheet are only ever used by the
// site owner, but were being downloaded by every visitor. admin.css is imported solely by
// this module, so it moves into the same chunk.
const Admin = lazy(() => import('./pages/Admin'));

/** Renders nothing; exists so the hook sits inside both the router and PoemsProvider. */
function RouteMeta() {
  useRouteMeta();
  return null;
}

/**
 * The scrim hides the flat background colour while the parchment image loads, then fades.
 * On a prerendered page it does the opposite: the markup is already painted, and React
 * re-creating this element on mount restarts the 400ms animation from opacity 1, covering
 * content the visitor could already see. Under mobile CPU throttling the remount lands
 * after the prerendered scrim has finished, so it reads as a flash — and it destroyed the
 * Largest Contentful Paint measurement, which reported NO_LCP on most mobile runs.
 *
 * Read once at module scope: the prerenderer strips the scrim from its output and marks
 * the document, so this is false for every prerendered route and true in dev.
 */
const NEEDS_SCRIM =
  typeof document === 'undefined' || !document.documentElement.hasAttribute('data-prerendered');

export default function App() {
  return (
    <PoemsProvider>
      <RouteMeta />
      {NEEDS_SCRIM && <div className="page-load-scrim" aria-hidden="true" />}
      <Routes>
        {/* The admin portal runs in English by default, independently of the public site,
            which stays Hungarian. A nested provider keeps the two separate: switching
            language inside the portal cannot affect the rest of the site, and leaving it
            unmounts this provider entirely. */}
        <Route
          path="/admin"
          element={
            <LanguageProvider defaultLang="en" scoped>
              {/* Untranslated: the portal defaults to English and this shows only for the
                  moment the chunk is in flight, before the dictionary is even loaded. */}
              <Suspense fallback={<p className="loading-prompt">Loading…</p>}>
                <Admin />
              </Suspense>
            </LanguageProvider>
          }
        />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/poems" element={<Poems />} />
          <Route path="/poems/:id" element={<Poems />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          {/* Anything else. Rendered inside Layout so the header and footer stay,
              leaving the visitor somewhere to go rather than on a bare page. */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </PoemsProvider>
  );
}

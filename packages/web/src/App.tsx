import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PageTransition } from './components/PageTransition';
import { ContentProvider } from './context/ContentContext';
import About from './pages/About';
import Contact from './pages/Contact';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import ProjectDetail from './pages/ProjectDetail';

// Lazy so the portal — and the editing UI no visitor needs — stays out of the bundle
// downloaded on a first visit.
const Admin = lazy(() => import('./pages/Admin'));

export default function App() {
  // Captured once per render and used for both the transition key and the Routes, so an
  // exiting page keeps rendering the route it was mounted for.
  const location = useLocation();

  return (
    <ContentProvider>
      <Layout>
        <PageTransition pathname={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route
              path="/admin"
              element={
                <Suspense fallback={<div className="page" />}>
                  <Admin />
                </Suspense>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </Layout>
    </ContentProvider>
  );
}

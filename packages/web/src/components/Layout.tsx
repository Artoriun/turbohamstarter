import type { ReactNode } from 'react';
import { useRouteMeta } from '../lib/useRouteMeta';
import { Footer } from './Footer';
import { Header } from './Header';

/**
 * Page chrome shared by every route. useRouteMeta lives here rather than in each page so
 * a new page gets correct <title>, description and canonical for free.
 */
export function Layout({ children }: { children: ReactNode }) {
  useRouteMeta();
  return (
    <div className="site">
      <Header />
      <main id="main" className="main-content">
        {children}
      </main>
      <Footer />
    </div>
  );
}

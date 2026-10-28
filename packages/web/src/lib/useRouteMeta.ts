import { metaForRoute } from '@hamstarter/shared';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useContent } from '../context/ContentContext';

/**
 * Keeps document.title, the meta description and the canonical link in step with the
 * current route, using the same helper the prerender script uses so a client-side
 * navigation lands on exactly the title that is already in the prerendered HTML.
 *
 * Reads the live sections rather than the bundled ones, so text edited in the admin
 * portal is reflected without a rebuild.
 */
export function useRouteMeta() {
  const { pathname } = useLocation();
  const { sections } = useContent();

  useEffect(() => {
    // Router basename is stripped from pathname already, so this matches the paths the
    // prerenderer writes.
    const { title, description } = metaForRoute(pathname, sections);
    document.title = title;

    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'description';
        document.head.appendChild(tag);
      }
      tag.content = description;
    }

    // Query strings are stripped: ?lang= produces the same page in another language, and
    // pointing both at one canonical stops them competing as duplicates.
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href.split('?')[0];
  }, [pathname, sections]);
}

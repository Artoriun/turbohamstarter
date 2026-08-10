import { metaForRoute } from '@gedichtenv2/shared';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePoems } from '../context/PoemsContext';

/**
 * Keeps document.title and the meta description in step with the current route, using the
 * same helper the prerender script uses so a client-side navigation lands on exactly the
 * title that is already in the prerendered HTML.
 *
 * Reads the live poems rather than the bundled ones, so a title edited in the admin
 * portal is reflected without a rebuild.
 */
export function useRouteMeta() {
  const { pathname } = useLocation();
  const poems = usePoems();

  useEffect(() => {
    // Router basename is stripped from pathname already, so this matches the paths the
    // prerenderer writes.
    const { title, description } = metaForRoute(pathname, poems);
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
  }, [pathname, poems]);
}

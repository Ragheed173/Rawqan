import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Resets scroll position on route change (SPA navigation). */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Skip the no-op scroll on first load: scrollTo can force a synchronous
    // layout while styles are dirty, and at mount we're already at the top.
    if (window.scrollY === 0) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

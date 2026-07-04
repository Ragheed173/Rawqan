import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics';

/**
 * Fires a PAGE_VIEW on every public route change, and a one-time QR_SCAN when the
 * visitor arrives via a QR code (`?src=qr`). Mounted inside the public layout so
 * admin navigation is never tracked (Task 22 analytics).
 */
export function AnalyticsTracker() {
  const location = useLocation();
  const qrCounted = useRef(false);

  useEffect(() => {
    trackEvent('PAGE_VIEW', { path: location.pathname });
    if (!qrCounted.current && new URLSearchParams(location.search).get('src') === 'qr') {
      qrCounted.current = true;
      trackEvent('QR_SCAN', { path: location.pathname });
    }
  }, [location.pathname, location.search]);

  return null;
}

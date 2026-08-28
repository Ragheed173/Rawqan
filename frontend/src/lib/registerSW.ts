/** Registers the service worker in production only (Task 22 PWA). */
export function shouldAutoActivateServiceWorker(pathname: string) {
  return !pathname.startsWith('/pos');
}

export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      let activating = false;

      const handleWaitingUpdate = () => {
        const worker = registration.waiting;
        if (!worker || !navigator.serviceWorker.controller) return;

        // POS updates stay manual so a reload can never interrupt queued sales.
        if (!shouldAutoActivateServiceWorker(window.location.pathname)) {
          window.dispatchEvent(new CustomEvent('rawaqan-sw-update', { detail: registration }));
          return;
        }

        // Public pages have no financial queue, so immediately replace stale caches.
        if (activating) return;
        activating = true;
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
        worker.postMessage({ type: 'SKIP_WAITING' });
      };

      handleWaitingUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            handleWaitingUpdate();
          }
        });
      });
    }).catch((err) => console.warn('SW registration failed:', err));
  });
}

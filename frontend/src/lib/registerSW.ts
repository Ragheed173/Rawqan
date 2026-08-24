/** Registers the service worker in production only (Task 22 PWA). */
export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('rawaqan-sw-update', { detail: registration }));
          }
        });
      });
    }).catch((err) => console.warn('SW registration failed:', err));
  });
}

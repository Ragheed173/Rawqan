import { StrictMode, Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider, queryClient } from '@/providers/QueryProvider';
import { queryKeys } from '@/hooks/useMenu';
import { settingsService } from '@/services/settings.service';
import { menuService } from '@/services/menu.service';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/lib/errorMonitor';
import { registerServiceWorker } from '@/lib/registerSW';
import { App } from '@/App';
// Self-hosted fonts (perf): same-origin, cache-friendly, no render-blocking
// Google Fonts CSS. Only the weights actually used by the UI are shipped.
import '@fontsource/ibm-plex-sans-arabic/arabic-300.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/ibm-plex-sans-arabic/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/latin-700.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import './index.css';

installGlobalErrorHandlers();
registerServiceWorker();

// sonner is ~32KB of the entry and no toast can appear at first paint, so
// mount the Toaster after first idle (or interaction) instead of eagerly.
const Toaster = lazy(() => import('sonner').then((m) => ({ default: m.Toaster })));

function DeferredToaster() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const reveal = () => setReady(true);
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reveal, { passive: true, once: true }));
    const hasIdle = typeof requestIdleCallback === 'function';
    const idle = hasIdle ? requestIdleCallback(reveal, { timeout: 3000 }) : setTimeout(reveal, 2500);
    return () => {
      events.forEach((e) => window.removeEventListener(e, reveal));
      if (hasIdle) cancelIdleCallback(idle as number);
      else clearTimeout(idle);
    };
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <Toaster
        position="top-center"
        richColors
        toastOptions={{ style: { fontFamily: 'IBM Plex Sans Arabic, sans-serif' } }}
      />
    </Suspense>
  );
}

// Warm the critical queries in parallel with the lazy route chunk (LCP):
// without this, the API fetch only starts after the page chunk finishes loading.
if (!window.location.pathname.startsWith('/admin')) {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsService.get,
    staleTime: 5 * 60 * 1000,
  });
  if (window.location.pathname.startsWith('/menu')) {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.categories,
      queryFn: menuService.getCategories,
      staleTime: 60 * 1000,
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <QueryProvider>
          <BrowserRouter>
            <App />
            <DeferredToaster />
          </BrowserRouter>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

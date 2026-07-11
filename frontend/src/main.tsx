import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
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
            <Toaster
              position="top-center"
              richColors
              toastOptions={{ style: { fontFamily: 'IBM Plex Sans Arabic, sans-serif' } }}
            />
          </BrowserRouter>
        </QueryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/lib/errorMonitor';
import { registerServiceWorker } from '@/lib/registerSW';
import { App } from '@/App';
import './index.css';

installGlobalErrorHandlers();
registerServiceWorker();

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

import * as Sentry from '@sentry/react';
import { config } from '@/config/env';

let monitoringEnabled = false;

/** Starts privacy-safe production monitoring when VITE_SENTRY_DSN is configured. */
export function initializeErrorMonitoring() {
  if (!config.sentryDsn || monitoringEnabled) return false;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    release: config.release,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    },
  });
  monitoringEnabled = true;
  return true;
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (monitoringEnabled) Sentry.captureException(error, { extra: context });
  if (import.meta.env.DEV || !monitoringEnabled)
    console.error('[error-monitor]', error, context ?? {});
}

/** Installs global handlers for uncaught errors and unhandled rejections. */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, { type: 'window.error' }));
  window.addEventListener('unhandledrejection', (e) =>
    reportError(e.reason, { type: 'unhandledrejection' }),
  );
}

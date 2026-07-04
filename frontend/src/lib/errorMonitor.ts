/**
 * Lightweight error monitoring shim (Task 22). Logs to the console in dev and is
 * the single integration point for a real service (Sentry/LogRocket) in prod —
 * swap the body of `reportError` without touching call sites.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  console.error('[error-monitor]', error, context ?? {});
  // e.g. Sentry.captureException(error, { extra: context });
}

/** Installs global handlers for uncaught errors and unhandled rejections. */
export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message, { type: 'window.error' }));
  window.addEventListener('unhandledrejection', (e) =>
    reportError(e.reason, { type: 'unhandledrejection' }),
  );
}

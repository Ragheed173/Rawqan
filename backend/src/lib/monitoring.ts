import * as Sentry from "@sentry/node";
import { env } from "../config/env.js";

let enabled = false;

export function initializeMonitoring() {
  if (!env.SENTRY_DSN || enabled) return false;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  });
  enabled = true;
  return true;
}

export function captureBackendException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!enabled) return;
  Sentry.captureException(error, { extra: context });
}

export async function flushMonitoring(timeoutMs = 2_000) {
  if (enabled) await Sentry.flush(timeoutMs);
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Frontend runtime config, sourced from Vite env vars. */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  siteUrl: import.meta.env.VITE_SITE_URL ?? window.location.origin,
  apiTimeoutMs: positiveInteger(import.meta.env.VITE_API_TIMEOUT_MS, 12_000),
  sentryDsn: import.meta.env.VITE_SENTRY_DSN?.trim() || undefined,
  sentryEnvironment: import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE,
  release: import.meta.env.VITE_APP_RELEASE?.trim() || undefined,
} as const;

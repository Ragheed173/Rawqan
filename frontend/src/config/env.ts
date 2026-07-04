/** Frontend runtime config, sourced from Vite env vars. */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  siteUrl: import.meta.env.VITE_SITE_URL ?? window.location.origin,
} as const;

import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { config } from '@/config/env';

/** Shape of the backend's error envelope. */
export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

/**
 * In-memory access token store. Kept out of localStorage to reduce XSS blast
 * radius — the refresh token lives in an httpOnly cookie. On a cold load the
 * app silently calls /auth/refresh to rehydrate the session.
 */
let accessToken: string | null = null;
export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

export const api: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (accessToken) cfg.headers.set('Authorization', `Bearer ${accessToken}`);
  return cfg;
});

// ─── Silent refresh on 401 ───────────────────────────────────
let refreshing: Promise<string | null> | null = null;

async function requestRefresh(): Promise<string | null> {
  try {
    const res = await axios.post<{ success: true; data: { accessToken: string } }>(
      `${config.apiBaseUrl}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const token = res.data.data.accessToken;
    tokenStore.set(token);
    return token;
  } catch {
    tokenStore.set(null);
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const isAuthRoute = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthRoute) {
      original._retried = true;
      refreshing ??= requestRefresh().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        original.headers.set('Authorization', `Bearer ${token}`);
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Extracts a human-readable message from an unknown error. */
export function getApiErrorMessage(error: unknown, fallback = 'حدث خطأ ما'): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as ApiErrorBody | undefined)?.error?.message ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/** Unwraps the { success, data } envelope. */
export async function unwrap<T>(promise: Promise<{ data: { data: T } }>): Promise<T> {
  const res = await promise;
  return res.data.data;
}

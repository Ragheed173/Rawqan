import { api } from '@/lib/apiClient';

type EventType = 'PAGE_VIEW' | 'ITEM_VIEW' | 'CATEGORY_VIEW' | 'QR_SCAN';

/**
 * Fire-and-forget analytics beacon (Task 22). Never throws into the UI; a failed
 * beacon is silently dropped. ITEM_VIEW is tracked server-side on the dish fetch,
 * so the client only sends page/category/QR signals.
 */
export function trackEvent(type: EventType, payload: { categoryId?: string; path?: string } = {}) {
  api.post('/analytics/track', { type, ...payload }).catch(() => {
    /* analytics is best-effort */
  });
}

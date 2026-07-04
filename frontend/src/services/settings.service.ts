import { api, unwrap } from '@/lib/apiClient';
import type { RestaurantSettings } from '@/types';

export const settingsService = {
  get: () => unwrap<RestaurantSettings>(api.get('/settings')),
};

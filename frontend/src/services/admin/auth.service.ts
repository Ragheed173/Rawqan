import { api, tokenStore, unwrap } from '@/lib/apiClient';
import type { AdminProfile } from '@/types';

interface AuthPayload {
  admin: AdminProfile;
  accessToken: string;
}

export const authService = {
  async login(email: string, password: string): Promise<AdminProfile> {
    const data = await unwrap<AuthPayload>(api.post('/auth/login', { email, password }));
    tokenStore.set(data.accessToken);
    return data.admin;
  },

  /** Silent session restore on cold load (refresh cookie → new access token). */
  async restore(): Promise<AdminProfile | null> {
    try {
      const data = await unwrap<AuthPayload>(api.post('/auth/refresh'));
      tokenStore.set(data.accessToken);
      return data.admin;
    } catch {
      tokenStore.set(null);
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStore.set(null);
    }
  },
};

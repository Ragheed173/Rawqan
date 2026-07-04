import { create } from 'zustand';
import type { AdminProfile } from '@/types';
import { authService } from '@/services/admin/auth.service';

interface AuthState {
  admin: AdminProfile | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
}

/** Global admin auth state. Access token lives in apiClient's in-memory store. */
export const useAuthStore = create<AuthState>((set) => ({
  admin: null,
  status: 'idle',

  login: async (email, password) => {
    const admin = await authService.login(email, password);
    set({ admin, status: 'authenticated' });
  },

  logout: async () => {
    await authService.logout();
    set({ admin: null, status: 'unauthenticated' });
  },

  restore: async () => {
    set({ status: 'loading' });
    const admin = await authService.restore();
    set({ admin, status: admin ? 'authenticated' : 'unauthenticated' });
  },
}));

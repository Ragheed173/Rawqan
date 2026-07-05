import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePermissions } from './usePermissions';
import { useAuthStore } from '@/store/auth';
import type { AdminProfile } from '@/types';

function setAdmin(admin: Partial<AdminProfile> | null) {
  act(() => {
    useAuthStore.setState({
      admin: admin as AdminProfile | null,
      status: admin ? 'authenticated' : 'unauthenticated',
    });
  });
}

afterEach(() => setAdmin(null));

describe('usePermissions', () => {
  it('denies everything when no admin is signed in', () => {
    setAdmin(null);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions).toEqual([]);
    expect(result.current.can('menu:write')).toBe(false);
    expect(result.current.canAny('menu:write', 'admin:manage')).toBe(false);
  });

  it('grants exactly the permissions on the admin profile', () => {
    setAdmin({ role: 'STAFF', roleLabel: 'موظف', permissions: ['menu:read', 'menu:write'] });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can('menu:read')).toBe(true);
    expect(result.current.can('menu:write')).toBe(true);
    expect(result.current.can('menu:delete')).toBe(false);
    expect(result.current.can('admin:manage')).toBe(false);
  });

  it('canAny passes when at least one permission is held', () => {
    setAdmin({ role: 'MANAGER', roleLabel: 'مدير', permissions: ['analytics:read'] });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canAny('admin:manage', 'analytics:read')).toBe(true);
    expect(result.current.canAny('admin:manage', 'backup:manage')).toBe(false);
  });
});

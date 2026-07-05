import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, roleHas, PERMISSIONS } from '../src/config/permissions.js';

describe('RBAC matrix', () => {
  it('grants SUPER_ADMIN every permission', () => {
    for (const p of PERMISSIONS) expect(roleHas('SUPER_ADMIN', p)).toBe(true);
  });

  it('withholds destructive/admin permissions from STAFF', () => {
    expect(roleHas('STAFF', 'menu:read')).toBe(true);
    expect(roleHas('STAFF', 'menu:write')).toBe(true);
    expect(roleHas('STAFF', 'menu:delete')).toBe(false);
    expect(roleHas('STAFF', 'admin:manage')).toBe(false);
    expect(roleHas('STAFF', 'settings:write')).toBe(false);
  });

  it('gives MANAGER menu/category control but not admin or backup management', () => {
    expect(roleHas('MANAGER', 'category:delete')).toBe(true);
    expect(roleHas('MANAGER', 'import:manage')).toBe(true);
    expect(roleHas('MANAGER', 'admin:manage')).toBe(false);
    expect(roleHas('MANAGER', 'backup:manage')).toBe(false);
  });

  it('never lets a lower role exceed SUPER_ADMIN', () => {
    for (const role of ['MANAGER', 'STAFF'] as const) {
      for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
    }
  });
});

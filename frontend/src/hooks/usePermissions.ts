import { useAuthStore } from '@/store/auth';
import type { Permission } from '@/types';

/** Convenience hook for permission-gated UI (Task 22 RBAC). */
export function usePermissions() {
  const admin = useAuthStore((s) => s.admin);
  const permissions = admin?.permissions ?? [];
  const can = (p: Permission) => permissions.includes(p);
  const canAny = (...ps: Permission[]) => ps.some((p) => permissions.includes(p));
  return { role: admin?.role, roleLabel: admin?.roleLabel, permissions, can, canAny };
}

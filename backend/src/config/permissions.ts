import type { AdminRole } from "@prisma/client";

/**
 * Permission-based access control (Task 22). Roles map to a fixed set of
 * permissions; routes require a permission rather than a specific role, so the
 * matrix can evolve without touching route definitions.
 */
export const PERMISSIONS = [
  "menu:read",
  "menu:write",
  "menu:delete",
  "category:write",
  "category:delete",
  "settings:write",
  "analytics:read",
  "logs:read",
  "import:manage",
  "admin:manage",
  "backup:manage",
  "pos:operate",
  "pos:table:configure",
  "pos:discount",
  "pos:void",
  "pos:refund",
  "pos:receipt:reprint",
  "pos:reservation:manage",
  "pos:shift:self",
  "pos:reports:read",
  "pos:audit:read",
  "pos:device:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MANAGER: Permission[] = [
  "menu:read",
  "menu:write",
  "menu:delete",
  "category:write",
  "category:delete",
  "settings:write",
  "analytics:read",
  "logs:read",
  "import:manage",
];

const STAFF: Permission[] = ["menu:read", "menu:write", "analytics:read"];

const CASHIER: Permission[] = [
  "pos:operate",
  "pos:receipt:reprint",
  "pos:reservation:manage",
  "pos:shift:self",
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS, // all
  MANAGER,
  STAFF,
  CASHIER,
};

export function roleHas(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Human labels (for the admin UI). */
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "مدير عام",
  MANAGER: "مدير",
  STAFF: "موظف",
  CASHIER: "كاشير",
};

import { describe, expect, it } from "vitest";
import { canAccessAdminPath } from "./AdminLayout";
import type { Permission } from "@/types";

const cashier: Permission[] = [
  "pos:operate",
  "pos:receipt:reprint",
  "pos:reservation:manage",
  "pos:shift:self",
];

describe("admin route permissions", () => {
  it.each([
    "/admin",
    "/admin/categories",
    "/admin/meals",
    "/admin/settings",
    "/admin/admins",
    "/admin/pos/reports",
  ])("blocks a cashier from %s", (pathname) => {
    expect(canAccessAdminPath(pathname, cashier, "CASHIER")).toBe(false);
  });

  it("blocks every administration URL for a cashier even when permissions overlap", () => {
    expect(
      canAccessAdminPath(
        "/admin/pos/reservations",
        ["pos:reservation:manage"],
        "CASHIER",
      ),
    ).toBe(false);
  });

  it("allows each authorized administration area", () => {
    expect(canAccessAdminPath("/admin", ["menu:read"])).toBe(true);
    expect(canAccessAdminPath("/admin/settings", ["settings:write"])).toBe(true);
    expect(canAccessAdminPath("/admin/admins", ["admin:manage"])).toBe(true);
    expect(canAccessAdminPath("/admin/pos/tables", ["pos:table:configure"])).toBe(true);
  });
});

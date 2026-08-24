import { describe, expect, it } from "vitest";
import { visibleAdminPosSections } from "./AdminPosPages";

describe("admin POS permission UX", () => {
  it("hides privileged administration from a cashier", () => {
    expect(
      visibleAdminPosSections([
        "pos:operate",
        "pos:receipt:reprint",
        "pos:reservation:manage",
      ]).map((row) => row.label),
    ).toEqual(["الحجوزات"]);
  });

  it("shows all operational administration to a super admin", () => {
    const sections = visibleAdminPosSections([
      "pos:table:configure",
      "pos:device:manage",
      "pos:reports:read",
      "pos:reservation:manage",
      "pos:audit:read",
    ]);
    expect(sections.map((row) => row.label)).toEqual(
      expect.arrayContaining([
        "إعداد الطاولات",
        "الأجهزة والإقران",
        "تقارير المبيعات",
        "سجل الفواتير",
        "الحجوزات",
        "سجل تدقيق POS",
      ]),
    );
  });
});

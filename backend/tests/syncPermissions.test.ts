import { describe, expect, it } from "vitest";
import {
  assertSyncOperationPermission,
  canRecoverMissingSyncDependencies,
} from "../src/modules/pos/sync.service.js";

describe("offline sync authorization", () => {
  it("recovers only cancellation from a missing historical dependency", () => {
    expect(canRecoverMissingSyncDependencies("CANCEL_ORDER")).toBe(true);
    expect(canRecoverMissingSyncDependencies("FINALIZE_INVOICE")).toBe(false);
    expect(canRecoverMissingSyncDependencies("OPEN_ORDER")).toBe(false);
  });

  it("allows cashier operational replay", () => {
    expect(() => assertSyncOperationPermission("CASHIER", "OPEN_ORDER")).not.toThrow();
    expect(() => assertSyncOperationPermission("CASHIER", "CANCEL_ORDER")).not.toThrow();
    expect(() => assertSyncOperationPermission("CASHIER", "CREATE_PAYMENT")).not.toThrow();
    expect(() => assertSyncOperationPermission("CASHIER", "CREATE_RESERVATION")).not.toThrow();
  });

  it.each(["APPLY_DISCOUNT", "VOID_INVOICE", "REFUND_INVOICE"])("rejects cashier replay of %s", (operationType) => {
    expect(() => assertSyncOperationPermission("CASHIER", operationType)).toThrowError(expect.objectContaining({ code: "PERMISSION_DENIED" }));
  });

  it("allows the super admin privileged replay", () => {
    for (const operationType of ["APPLY_DISCOUNT", "VOID_INVOICE", "REFUND_INVOICE"]) expect(() => assertSyncOperationPermission("SUPER_ADMIN", operationType)).not.toThrow();
  });
});

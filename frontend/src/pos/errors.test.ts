import { describe, expect, it } from "vitest";
import { POS_ERROR_MESSAGES, posErrorMessage } from "./errors";

describe("Arabic POS operational errors", () => {
  it("covers every release-required domain code without leaking internals", () => {
    const required = [
      "TABLE_OCCUPIED", "TABLE_DISABLED", "ORDER_NOT_FOUND", "ORDER_NOT_OPEN", "INVALID_ORDER_STATE",
      "VERSION_CONFLICT", "INVALID_QUANTITY", "INVALID_MODIFIER_SELECTION", "INVALID_PAYMENT_TOTAL",
      "INVALID_CASH_TENDER", "DISCOUNT_NOT_ALLOWED", "SHIFT_REQUIRED", "SHIFT_ALREADY_OPEN",
      "SHIFT_NOT_OPEN", "INVOICE_NOT_FOUND", "INVOICE_ALREADY_PAID", "INVOICE_ALREADY_VOIDED",
      "REFUND_EXCEEDS_AVAILABLE", "SYNC_DEPENDENCY_MISSING", "SYNC_CONFLICT", "SYNC_SEQUENCE_CONFLICT",
      "CONFLICT", "DEVICE_NOT_AUTHORIZED",
      "OFFLINE_CAPABILITY_EXPIRED",
    ];
    expect(required.every((code) => POS_ERROR_MESSAGES[code]?.length > 20)).toBe(true);
    expect(JSON.stringify(POS_ERROR_MESSAGES)).not.toMatch(/stack|Prisma|SQL/i);
  });

  it("maps local command codes and uses a safe fallback", () => {
    expect(posErrorMessage(new Error("SHIFT_REQUIRED"))).toContain("وردية");
    expect(posErrorMessage(new Error("unknown detail"), "رسالة آمنة")).toBe("رسالة آمنة");
  });
});

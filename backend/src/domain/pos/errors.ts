export const POS_ERROR_CODES = [
  "TABLE_OCCUPIED",
  "TABLE_DISABLED",
  "TABLE_NOT_FOUND",
  "ORDER_NOT_FOUND",
  "ORDER_NOT_OPEN",
  "INVALID_ORDER_STATE",
  "VERSION_CONFLICT",
  "INVALID_QUANTITY",
  "INVALID_MODIFIER_SELECTION",
  "INVALID_PAYMENT_TOTAL",
  "INVALID_CASH_TENDER",
  "DISCOUNT_NOT_ALLOWED",
  "INVALID_DISCOUNT",
  "SHIFT_REQUIRED",
  "SHIFT_ALREADY_OPEN",
  "SHIFT_NOT_OPEN",
  "INVOICE_NOT_FOUND",
  "INVOICE_ALREADY_PAID",
  "INVOICE_ALREADY_VOIDED",
  "REFUND_EXCEEDS_AVAILABLE",
  "ALREADY_APPLIED",
  "SYNC_DEPENDENCY_MISSING",
  "SYNC_CONFLICT",
  "DEVICE_NOT_AUTHORIZED",
  "PERMISSION_DENIED",
  "OFFLINE_CAPABILITY_EXPIRED",
] as const;

export type PosErrorCode = (typeof POS_ERROR_CODES)[number];

export class PosDomainError extends Error {
  constructor(
    public readonly code: PosErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "PosDomainError";
  }
}

export function posAssert(
  condition: unknown,
  code: PosErrorCode,
  message: string,
  details?: unknown,
): asserts condition {
  if (!condition) throw new PosDomainError(code, message, details);
}

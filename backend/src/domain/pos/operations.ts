import { createHash } from "node:crypto";
import { posAssert } from "./errors.js";

export function reconcileShift(openingCashMinor: bigint, cashSalesMinor: bigint, cashRefundsMinor: bigint, actualClosingCashMinor?: bigint) {
  posAssert(openingCashMinor >= 0n && cashSalesMinor >= 0n && cashRefundsMinor >= 0n, "INVALID_PAYMENT_TOTAL", "Shift cash values cannot be negative");
  const expectedCashMinor = openingCashMinor + cashSalesMinor - cashRefundsMinor;
  posAssert(expectedCashMinor >= 0n, "INVALID_PAYMENT_TOTAL", "Cash refunds cannot exceed available shift cash");
  if (actualClosingCashMinor === undefined) return { expectedCashMinor };
  posAssert(actualClosingCashMinor >= 0n, "INVALID_PAYMENT_TOTAL", "Closing cash cannot be negative");
  return { expectedCashMinor, differenceMinor: actualClosingCashMinor - expectedCashMinor };
}

export function assertReservation(input: { startsAt: Date; endsAt?: Date | null; guestCount: number; version: number }, now?: Date): void {
  posAssert(Number.isInteger(input.guestCount) && input.guestCount > 0, "INVALID_QUANTITY", "Guest count must be positive");
  posAssert(Number.isInteger(input.version) && input.version > 0, "VERSION_CONFLICT", "Reservation version must be positive");
  if (input.endsAt) posAssert(input.endsAt > input.startsAt, "INVALID_ORDER_STATE", "Reservation end must be after start");
  if (now) posAssert(input.startsAt >= now, "INVALID_ORDER_STATE", "New reservations cannot start in the past");
}

export function reservationsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

export function hashOperationRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

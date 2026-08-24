import { sumMinorUnits } from "../money.js";
import { posAssert } from "./errors.js";

export type PaymentAllocation =
  | { method: "CASH"; amountMinor: bigint; tenderedMinor: bigint }
  | { method: "VISA"; amountMinor: bigint };

export type ValidatedPayment = PaymentAllocation & { changeMinor: bigint | null };

export function validatePayments(
  dueMinor: bigint,
  allocations: readonly PaymentAllocation[],
  requireExact = true,
): { payments: ValidatedPayment[]; allocatedMinor: bigint; remainingMinor: bigint } {
  posAssert(dueMinor >= 0n, "INVALID_PAYMENT_TOTAL", "Amount due cannot be negative");
  posAssert(allocations.length > 0, "INVALID_PAYMENT_TOTAL", "At least one payment is required");
  const payments = allocations.map((payment): ValidatedPayment => {
    posAssert(payment.amountMinor > 0n, "INVALID_PAYMENT_TOTAL", "Payment amount must be positive");
    if (payment.method === "CASH") {
      posAssert(payment.tenderedMinor >= payment.amountMinor, "INVALID_CASH_TENDER", "Cash tendered is less than the cash allocation");
      return { ...payment, changeMinor: payment.tenderedMinor - payment.amountMinor };
    }
    return { ...payment, changeMinor: null };
  });
  const allocatedMinor = sumMinorUnits(payments.map((payment) => payment.amountMinor));
  posAssert(allocatedMinor <= dueMinor, "INVALID_PAYMENT_TOTAL", "Payment allocation exceeds amount due");
  if (requireExact) posAssert(allocatedMinor === dueMinor, "INVALID_PAYMENT_TOTAL", "Payment allocation must exactly equal amount due");
  return { payments, allocatedMinor, remainingMinor: dueMinor - allocatedMinor };
}

export function refundableAmount(totalMinor: bigint, refundedMinor: bigint): bigint {
  posAssert(totalMinor >= 0n && refundedMinor >= 0n && refundedMinor <= totalMinor, "REFUND_EXCEEDS_AVAILABLE", "Invalid refund state");
  return totalMinor - refundedMinor;
}

export function validateRefund(totalMinor: bigint, refundedMinor: bigint, requestedMinor: bigint): bigint {
  const available = refundableAmount(totalMinor, refundedMinor);
  posAssert(requestedMinor > 0n && requestedMinor <= available, "REFUND_EXCEEDS_AVAILABLE", "Refund exceeds available amount", { availableMinor: available.toString() });
  return available - requestedMinor;
}

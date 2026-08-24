import { posAssert } from "./errors.js";

export type OrderState = "OPEN" | "BILL_REQUESTED" | "PARTIALLY_BILLED" | "CLOSED" | "CANCELLED" | "MERGED";
export type InvoiceState = "OPEN" | "PAID" | "VOIDED" | "PARTIALLY_REFUNDED" | "REFUNDED";

const ORDER_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  OPEN: ["BILL_REQUESTED", "PARTIALLY_BILLED", "CLOSED", "CANCELLED", "MERGED"],
  BILL_REQUESTED: ["OPEN", "PARTIALLY_BILLED", "CLOSED", "CANCELLED", "MERGED"],
  PARTIALLY_BILLED: ["BILL_REQUESTED", "CLOSED"],
  CLOSED: [],
  CANCELLED: [],
  MERGED: [],
};

const INVOICE_TRANSITIONS: Record<InvoiceState, readonly InvoiceState[]> = {
  OPEN: ["PAID", "VOIDED"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  REFUNDED: [],
  VOIDED: [],
};

export function assertOrderTransition(from: OrderState, to: OrderState): void {
  posAssert(ORDER_TRANSITIONS[from].includes(to), "INVALID_ORDER_STATE", `Order cannot transition from ${from} to ${to}`, { from, to });
}

export function assertInvoiceTransition(from: InvoiceState, to: InvoiceState): void {
  const code = from === "VOIDED" ? "INVOICE_ALREADY_VOIDED" : from === "PAID" && to === "PAID" ? "INVOICE_ALREADY_PAID" : "INVALID_ORDER_STATE";
  posAssert(INVOICE_TRANSITIONS[from].includes(to), code, `Invoice cannot transition from ${from} to ${to}`, { from, to });
}

export function invoiceStatusForRefund(totalMinor: bigint, refundedMinor: bigint): InvoiceState {
  posAssert(refundedMinor > 0n && refundedMinor <= totalMinor, "REFUND_EXCEEDS_AVAILABLE", "Invalid cumulative refund");
  return refundedMinor === totalMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

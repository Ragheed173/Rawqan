import { describe, expect, it } from "vitest";
import { allocateDiscountAcrossLines, allocateLinesEqual, calculateDiscount, calculateInvoiceTotals, splitEqual, validateQuantitySplits } from "../src/domain/pos/billing.js";
import { addRational, compareRational, reduceRational } from "../src/domain/pos/rational.js";
import { hashOperationRequest, reconcileShift, reservationsOverlap } from "../src/domain/pos/operations.js";
import { validatePayments, validateRefund } from "../src/domain/pos/payments.js";
import { priceOrderLine } from "../src/domain/pos/pricing.js";
import { assertInvoiceTransition, assertOrderTransition, invoiceStatusForRefund } from "../src/domain/pos/stateMachines.js";

describe("POS pricing", () => {
  const groups = [
    { id: "size", type: "VARIANT" as const, minSelections: 1, maxSelections: 1 },
    { id: "extras", type: "ADD_ON" as const, minSelections: 0, maxSelections: 3 },
  ];

  it("uses promotional base, DELTA variants, add-ons, and quantity exactly", () => {
    expect(priceOrderLine({
      basePriceMinor: 2500n,
      promotionalPriceMinor: 2400n,
      quantity: 2,
      groups,
      modifiers: [
        { id: "large", groupId: "size", groupType: "VARIANT", priceType: "DELTA", priceMinor: 700n },
        { id: "cheese", groupId: "extras", groupType: "ADD_ON", priceType: "DELTA", priceMinor: 300n },
      ],
    })).toMatchObject({ pricedBaseMinor: 3100n, addOnsMinor: 300n, unitPriceMinor: 3400n, lineTotalMinor: 6800n });
  });

  it("implements replacement variant semantics before add-ons", () => {
    expect(priceOrderLine({
      basePriceMinor: 2500n,
      quantity: 1,
      groups,
      modifiers: [
        { id: "large", groupId: "size", groupType: "VARIANT", priceType: "REPLACEMENT", priceMinor: 3200n },
        { id: "cheese", groupId: "extras", groupType: "ADD_ON", priceType: "DELTA", priceMinor: 300n },
        { id: "sauce", groupId: "extras", groupType: "ADD_ON", priceType: "DELTA", priceMinor: 200n },
      ],
    }).unitPriceMinor).toBe(3700n);
  });

  it("rejects quantity and modifier selection violations", () => {
    expect(() => priceOrderLine({ basePriceMinor: 1n, quantity: 0 })).toThrow("Quantity");
    expect(() => priceOrderLine({ basePriceMinor: 1n, quantity: 1, groups, modifiers: [] })).toThrow("requires");
  });
});

describe("POS billing and payments", () => {
  it("rounds percentage discounts and prevents over-discounting", () => {
    expect(calculateDiscount(19_999n, { type: "PERCENTAGE", percentageBasisPoints: 1000n })).toBe(2000n);
    expect(() => calculateDiscount(100n, { type: "FIXED", fixedAmountMinor: 101n })).toThrow("exceed");
    expect(calculateInvoiceTotals([10_000n, 5000n], [{ type: "FIXED", fixedAmountMinor: 2500n }])).toEqual({
      subtotalMinor: 15_000n,
      discountMinor: 2500n,
      totalMinor: 12_500n,
      discountAmounts: [2500n],
    });
  });

  it("splits equal totals deterministically without losing minor units", () => {
    expect(splitEqual(10_000n, 3)).toEqual([3334n, 3333n, 3333n]);
    expect(splitEqual(2n, 4)).toEqual([1n, 1n, 0n, 0n]);
  });

  it("reconciles per-line allocations to deterministic invoice totals", () => {
    const allocation = allocateLinesEqual([3333n, 3333n, 3334n], 3);
    expect(allocation.invoiceTotals).toEqual([3334n, 3333n, 3333n]);
    expect(allocation.lineAllocations.map((row) => row.reduce((sum, value) => sum + value, 0n))).toEqual([3333n, 3333n, 3334n]);
    expect([0, 1, 2].map((column) => allocation.lineAllocations.reduce((sum, row) => sum + row[column]!, 0n))).toEqual(allocation.invoiceTotals);
  });

  it("allocates invoice discount without negative line revenue", () => {
    expect(allocateDiscountAcrossLines([100n, 200n, 300n], 250n)).toEqual([100n, 150n, 0n]);
  });

  it("adds and compares rational quantities exactly", () => {
    expect(addRational({ numerator: 1n, denominator: 3n }, { numerator: 2n, denominator: 3n })).toEqual({ numerator: 1n, denominator: 1n });
    expect(reduceRational({ numerator: 6n, denominator: 9n })).toEqual({ numerator: 2n, denominator: 3n });
    expect(compareRational({ numerator: 2n, denominator: 3n }, { numerator: 1n, denominator: 1n })).toBe(-1);
  });

  it("prevents item split over-allocation", () => {
    validateQuantitySplits([{ orderItemId: "burger", orderedQuantity: 3, invoiceQuantities: [1, 2] }]);
    expect(() => validateQuantitySplits([{ orderItemId: "burger", orderedQuantity: 3, invoiceQuantities: [2, 2] }])).toThrow("exceeds");
  });

  it("validates exact cash/VISA allocation and change", () => {
    expect(validatePayments(10_000n, [
      { method: "CASH", amountMinor: 4000n, tenderedMinor: 5000n },
      { method: "VISA", amountMinor: 6000n },
    ])).toMatchObject({ allocatedMinor: 10_000n, remainingMinor: 0n, payments: [{ changeMinor: 1000n }, { changeMinor: null }] });
    expect(() => validatePayments(100n, [{ method: "CASH", amountMinor: 100n, tenderedMinor: 99n }])).toThrow("less");
    expect(() => validatePayments(100n, [{ method: "VISA", amountMinor: 99n }])).toThrow("exactly");
  });

  it("enforces cumulative refund limits", () => {
    expect(validateRefund(10_000n, 2000n, 3000n)).toBe(5000n);
    expect(() => validateRefund(10_000n, 9000n, 1001n)).toThrow("exceeds");
  });
});

describe("POS state, shifts, reservations, and idempotency", () => {
  it("enforces explicit order and invoice transitions", () => {
    expect(() => assertOrderTransition("OPEN", "BILL_REQUESTED")).not.toThrow();
    expect(() => assertOrderTransition("CLOSED", "OPEN")).toThrow("cannot transition");
    expect(() => assertInvoiceTransition("PAID", "PARTIALLY_REFUNDED")).not.toThrow();
    expect(() => assertInvoiceTransition("VOIDED", "PAID")).toThrow("cannot transition");
    expect(invoiceStatusForRefund(100n, 99n)).toBe("PARTIALLY_REFUNDED");
    expect(invoiceStatusForRefund(100n, 100n)).toBe("REFUNDED");
  });

  it("reconciles expected and actual shift cash exactly", () => {
    expect(reconcileShift(1000n, 5000n, 750n, 5200n)).toEqual({ expectedCashMinor: 5250n, differenceMinor: -50n });
  });

  it("uses half-open reservation overlap semantics", () => {
    const at = (hour: number) => new Date(`2026-08-23T${hour.toString().padStart(2, "0")}:00:00Z`);
    expect(reservationsOverlap(at(10), at(12), at(11), at(13))).toBe(true);
    expect(reservationsOverlap(at(10), at(12), at(12), at(13))).toBe(false);
  });

  it("hashes canonical requests independently of object key order", () => {
    expect(hashOperationRequest({ b: 2n, a: { y: 2, x: 1 } })).toBe(hashOperationRequest({ a: { x: 1, y: 2 }, b: 2n }));
    expect(hashOperationRequest({ amount: 1n })).not.toBe(hashOperationRequest({ amount: 2n }));
  });
});

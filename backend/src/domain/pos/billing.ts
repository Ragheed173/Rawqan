import { calculatePercentageDiscount, sumMinorUnits } from "../money.js";
import { posAssert } from "./errors.js";

export type DiscountRequest =
  | { type: "PERCENTAGE"; percentageBasisPoints: bigint }
  | { type: "FIXED"; fixedAmountMinor: bigint };

export function calculateDiscount(subtotalMinor: bigint, discount: DiscountRequest): bigint {
  posAssert(subtotalMinor >= 0n, "INVALID_DISCOUNT", "Subtotal cannot be negative");
  const calculated =
    discount.type === "PERCENTAGE"
      ? calculatePercentageDiscount(subtotalMinor, discount.percentageBasisPoints)
      : discount.fixedAmountMinor;
  posAssert(calculated >= 0n && calculated <= subtotalMinor, "INVALID_DISCOUNT", "Discount cannot exceed subtotal");
  return calculated;
}

export function calculateInvoiceTotals(
  lineTotals: readonly bigint[],
  discounts: readonly DiscountRequest[] = [],
) {
  posAssert(lineTotals.length > 0, "INVALID_ORDER_STATE", "An invoice requires at least one line");
  posAssert(lineTotals.every((value) => value >= 0n), "INVALID_ORDER_STATE", "Line totals cannot be negative");
  const subtotalMinor = sumMinorUnits(lineTotals);
  let remaining = subtotalMinor;
  const discountAmounts = discounts.map((discount) => {
    const amount = calculateDiscount(remaining, discount);
    remaining -= amount;
    return amount;
  });
  return {
    subtotalMinor,
    discountMinor: sumMinorUnits(discountAmounts),
    totalMinor: remaining,
    discountAmounts,
  };
}

export function splitEqual(totalMinor: bigint, parts: number): bigint[] {
  posAssert(totalMinor >= 0n, "INVALID_PAYMENT_TOTAL", "Split total cannot be negative");
  posAssert(Number.isInteger(parts) && parts > 0, "INVALID_PAYMENT_TOTAL", "Split count must be positive");
  const count = BigInt(parts);
  const base = totalMinor / count;
  const remainder = Number(totalMinor % count);
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1n : 0n));
}

export function allocateLinesToTargets(lineTotals: readonly bigint[], invoiceTotals: readonly bigint[]) {
  const parts = invoiceTotals.length;
  posAssert(parts > 0 && lineTotals.length > 0 && lineTotals.every((value) => value >= 0n) && invoiceTotals.every((value) => value >= 0n), "INVALID_ORDER_STATE", "Split requires non-negative lines and targets");
  posAssert(sumMinorUnits(lineTotals) === sumMinorUnits(invoiceTotals), "INVALID_PAYMENT_TOTAL", "Split targets must preserve the exact total");
  const lineAllocations = lineTotals.map((lineTotal) => splitEqual(lineTotal, parts));
  const columnTotals = Array.from({ length: parts }, (_, index) => sumMinorUnits(lineAllocations.map((row) => row[index]!)));

  for (let receiver = 0; receiver < parts; receiver += 1) {
    let deficit = invoiceTotals[receiver]! - columnTotals[receiver]!;
    while (deficit > 0n) {
      const donor = columnTotals.findIndex((total, index) => index !== receiver && total > invoiceTotals[index]!);
      posAssert(donor >= 0, "INVALID_PAYMENT_TOTAL", "Unable to reconcile equal line allocation");
      const lineIndex = lineAllocations.findIndex((row) => row[donor]! > 0n);
      posAssert(lineIndex >= 0, "INVALID_PAYMENT_TOTAL", "Unable to move an allocated minor unit");
      const surplus = columnTotals[donor]! - invoiceTotals[donor]!;
      const movable = lineAllocations[lineIndex]![donor]!;
      const amount = deficit < surplus ? (deficit < movable ? deficit : movable) : (surplus < movable ? surplus : movable);
      lineAllocations[lineIndex]![donor] -= amount;
      lineAllocations[lineIndex]![receiver] += amount;
      columnTotals[donor] -= amount;
      columnTotals[receiver] += amount;
      deficit -= amount;
    }
  }
  return { invoiceTotals, lineAllocations };
}

export function allocateLinesEqual(lineTotals: readonly bigint[], parts: number) {
  return allocateLinesToTargets(lineTotals, splitEqual(sumMinorUnits(lineTotals), parts));
}

export function allocateDiscountAcrossLines(lineSubtotals: readonly bigint[], discountMinor: bigint): bigint[] {
  posAssert(discountMinor >= 0n && discountMinor <= sumMinorUnits(lineSubtotals), "INVALID_DISCOUNT", "Discount exceeds allocated subtotal");
  let remaining = discountMinor;
  return lineSubtotals.map((subtotal) => {
    const amount = subtotal < remaining ? subtotal : remaining;
    remaining -= amount;
    return amount;
  });
}

export interface QuantityAllocation {
  orderItemId: string;
  orderedQuantity: number;
  invoiceQuantities: readonly number[];
}

export function validateQuantitySplits(allocations: readonly QuantityAllocation[]): void {
  for (const allocation of allocations) {
    posAssert(allocation.invoiceQuantities.every((quantity) => Number.isInteger(quantity) && quantity >= 0), "INVALID_QUANTITY", "Split quantities must be non-negative integers");
    const allocated = allocation.invoiceQuantities.reduce((sum, quantity) => sum + quantity, 0);
    posAssert(allocated <= allocation.orderedQuantity, "INVALID_QUANTITY", `Billed quantity exceeds ordered quantity for ${allocation.orderItemId}`);
  }
}

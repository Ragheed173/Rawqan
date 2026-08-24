import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  calculatePercentageDiscount,
  decimalToMinorUnits,
  formatMinorUnits,
  multiplyMinorUnits,
  percentageToBasisPoints,
  sumMinorUnits,
} from "../src/domain/money.js";

describe("exact money", () => {
  it("converts normal decimal values to integer minor units", () => {
    expect(decimalToMinorUnits("0")).toBe(0n);
    expect(decimalToMinorUnits("12.34")).toBe(1234n);
    expect(decimalToMinorUnits("-5.20")).toBe(-520n);
  });

  it("converts Prisma Decimal menu prices without Number conversion", () => {
    expect(decimalToMinorUnits(new Prisma.Decimal("85.10"))).toBe(8510n);
    expect(decimalToMinorUnits(new Prisma.Decimal("0.99"))).toBe(99n);
  });

  it("multiplies quantities and sums lines exactly", () => {
    const coffee = multiplyMinorUnits(1299n, 3n);
    const dessert = multiplyMinorUnits(750n, 2n);
    expect(coffee).toBe(3897n);
    expect(sumMinorUnits([coffee, dessert])).toBe(5397n);
    expect(() => multiplyMinorUnits(100n, -1n)).toThrow(
      "quantity cannot be negative",
    );
  });

  it("calculates percentage discounts using basis points", () => {
    expect(percentageToBasisPoints("12.5")).toBe(1250n);
    expect(calculatePercentageDiscount(20_000n, 1250n)).toBe(2500n);
    expect(calculatePercentageDiscount(19_999n, 1000n)).toBe(2000n);
  });

  it("uses explicit HALF_UP or DOWN rounding at minor-unit boundaries", () => {
    expect(decimalToMinorUnits("10.005", 2, "HALF_UP")).toBe(1001n);
    expect(decimalToMinorUnits("10.005", 2, "DOWN")).toBe(1000n);
    expect(decimalToMinorUnits("-10.005", 2, "HALF_UP")).toBe(-1001n);
    expect(calculatePercentageDiscount(1n, 5000n, "HALF_UP")).toBe(1n);
    expect(calculatePercentageDiscount(1n, 5000n, "DOWN")).toBe(0n);
  });

  it("formats minor units without floating-point arithmetic", () => {
    expect(formatMinorUnits(123456n, { locale: "en-US" })).toBe(
      "1,234.56\u00a0₪",
    );
    expect(formatMinorUnits(-50n, { locale: "en-US", currency: "ILS" })).toBe(
      "-0.50\u00a0₪",
    );
  });
});

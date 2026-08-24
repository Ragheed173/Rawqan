import { posAssert } from "./errors.js";

export interface RationalQuantity { numerator: bigint; denominator: bigint }

export function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function reduceRational(value: RationalQuantity): RationalQuantity {
  posAssert(value.denominator > 0n && value.numerator >= 0n, "INVALID_QUANTITY", "Rational quantity must be non-negative with a positive denominator");
  if (value.numerator === 0n) return { numerator: 0n, denominator: 1n };
  const divisor = gcd(value.numerator, value.denominator);
  return { numerator: value.numerator / divisor, denominator: value.denominator / divisor };
}

export function addRational(left: RationalQuantity, right: RationalQuantity): RationalQuantity {
  return reduceRational({ numerator: left.numerator * right.denominator + right.numerator * left.denominator, denominator: left.denominator * right.denominator });
}

export function compareRational(left: RationalQuantity, right: RationalQuantity): number {
  const difference = left.numerator * right.denominator - right.numerator * left.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

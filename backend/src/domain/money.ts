/**
 * Exact money helpers for POS/domain code.
 *
 * Financial amounts are represented as integer minor units (agorot/cents).
 * Decimal strings are accepted only at catalog boundaries; totals never use
 * JavaScript floating-point arithmetic.
 */
export type MinorUnits = bigint;

export type MoneyRoundingMode = "HALF_UP" | "DOWN";

export interface DecimalLike {
  toString(): string;
}

const powersOfTen = new Map<number, bigint>([[0, 1n]]);

function powerOfTen(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 12) {
    throw new RangeError("fractionDigits must be an integer between 0 and 12");
  }
  const cached = powersOfTen.get(exponent);
  if (cached !== undefined) return cached;
  const value = 10n ** BigInt(exponent);
  powersOfTen.set(exponent, value);
  return value;
}

/** Converts a decimal string/Prisma Decimal to exact integer minor units. */
export function decimalToMinorUnits(
  value: string | DecimalLike,
  fractionDigits = 2,
  rounding: MoneyRoundingMode = "HALF_UP",
): MinorUnits {
  const raw =
    typeof value === "string" ? value.trim() : value.toString().trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new TypeError(`Invalid decimal money value: ${raw}`);

  const factor = powerOfTen(fractionDigits);
  const negative = match[1] === "-";
  const whole = BigInt(match[2]);
  const fraction = match[3] ?? "";
  const retained = fraction
    .slice(0, fractionDigits)
    .padEnd(fractionDigits, "0");
  const discarded = fraction.slice(fractionDigits);

  let magnitude = whole * factor + BigInt(retained || "0");
  if (rounding === "HALF_UP" && discarded.length > 0 && discarded[0] >= "5") {
    magnitude += 1n;
  }

  return negative ? -magnitude : magnitude;
}

/** Multiplies a unit amount by a non-negative integer quantity exactly. */
export function multiplyMinorUnits(
  unitAmount: MinorUnits,
  quantity: bigint,
): MinorUnits {
  if (quantity < 0n) throw new RangeError("quantity cannot be negative");
  return unitAmount * quantity;
}

/** Adds any number of minor-unit amounts without converting to Number. */
export function sumMinorUnits(amounts: readonly MinorUnits[]): MinorUnits {
  return amounts.reduce((total, amount) => total + amount, 0n);
}

function divideRounded(
  numerator: bigint,
  denominator: bigint,
  rounding: MoneyRoundingMode,
): bigint {
  if (denominator <= 0n) throw new RangeError("denominator must be positive");
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (rounding === "DOWN" || remainder === 0n) return quotient;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

/**
 * Calculates an invoice discount from basis points (100% = 10_000).
 * HALF_UP means an exact half-minor-unit rounds away from zero.
 */
export function calculatePercentageDiscount(
  subtotal: MinorUnits,
  percentageBasisPoints: bigint,
  rounding: MoneyRoundingMode = "HALF_UP",
): MinorUnits {
  if (subtotal < 0n) throw new RangeError("subtotal cannot be negative");
  if (percentageBasisPoints < 0n || percentageBasisPoints > 10_000n) {
    throw new RangeError("percentageBasisPoints must be between 0 and 10,000");
  }
  return divideRounded(subtotal * percentageBasisPoints, 10_000n, rounding);
}

/** Converts an exact percentage string (e.g. "12.5") to basis points. */
export function percentageToBasisPoints(
  percentage: string | DecimalLike,
): bigint {
  const basisPoints = decimalToMinorUnits(percentage, 2, "HALF_UP");
  if (basisPoints < 0n || basisPoints > 10_000n) {
    throw new RangeError("percentage must be between 0 and 100");
  }
  return basisPoints;
}

interface FormatMoneyOptions {
  currency?: string;
  locale?: string;
  fractionDigits?: number;
}

/** Formats minor units without converting the amount to floating point. */
export function formatMinorUnits(
  amount: MinorUnits,
  options: FormatMoneyOptions = {},
): string {
  const { currency = "ILS", locale = "he-IL", fractionDigits = 2 } = options;
  const factor = powerOfTen(fractionDigits);
  const negative = amount < 0n;
  const magnitude = negative ? -amount : amount;
  const whole = magnitude / factor;
  const fraction = (magnitude % factor)
    .toString()
    .padStart(fractionDigits, "0");
  const groupedWhole = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(whole);
  const decimal =
    fractionDigits > 0 ? `${groupedWhole}.${fraction}` : groupedWhole;
  const signed = negative ? `-${decimal}` : decimal;
  const currencyLabel =
    currency === "ILS" || currency === "NIS" ? "₪" : currency;
  return `${signed}\u00a0${currencyLabel}`;
}

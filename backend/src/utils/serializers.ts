import { Prisma } from '@prisma/client';

/** Converts Prisma Decimal (and Decimal | null) to a JS number for JSON output. */
export function decimalToNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null || value === undefined) return null;
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

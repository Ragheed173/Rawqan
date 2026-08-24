/** JSON replacer for exact integer amounts that exceed JavaScript's safe range. */
export function bigintJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * Produces a plain JSON-compatible value while preserving BigInt values as
 * exact decimal strings. Phase 3 POS response paths must use this before
 * passing Prisma financial records to Express `res.json`.
 */
export function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value, bigintJsonReplacer)) as unknown;
}

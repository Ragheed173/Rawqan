import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { toJsonSafe } from "../src/utils/json.js";
import { sendPosSuccess } from "../src/utils/http.js";

describe("BigInt JSON readiness", () => {
  it("confirms native JSON serialization rejects Prisma BigInt values", () => {
    expect(() =>
      JSON.stringify({ totalMinor: 9_007_199_254_740_993n }),
    ).toThrow("BigInt");
  });

  it("serializes nested BigInts exactly without changing existing Decimal/Date JSON behavior", () => {
    const createdAt = new Date("2026-08-23T01:02:03.000Z");
    expect(
      toJsonSafe({
        totalMinor: 9_007_199_254_740_993n,
        lines: [{ amountMinor: 1250n }],
        legacyPrice: new Prisma.Decimal("12.50"),
        createdAt,
      }),
    ).toEqual({
      totalMinor: "9007199254740993",
      lines: [{ amountMinor: "1250" }],
      legacyPrice: "12.5",
      createdAt: "2026-08-23T01:02:03.000Z",
    });
  });

  it("uses decimal strings in the dedicated POS response envelope", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    sendPosSuccess({ status } as never, { totalMinor: 12_500n });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: { totalMinor: "12500" } });
  });
});

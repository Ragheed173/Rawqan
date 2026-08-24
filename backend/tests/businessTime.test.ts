import { describe, expect, it } from "vitest";
import {
  businessDateFor,
  businessDayBoundsFor,
  isValidTimeZone,
  parseBusinessDayCutoff,
} from "../src/domain/businessTime.js";

const config = { timeZone: "Asia/Hebron", businessDayCutoff: "04:00" };

describe("restaurant business time", () => {
  it("validates IANA zones and cutoff syntax", () => {
    expect(isValidTimeZone("Asia/Hebron")).toBe(true);
    expect(isValidTimeZone("Not/A_Zone")).toBe(false);
    expect(parseBusinessDayCutoff("04:00")).toEqual({ hour: 4, minute: 0 });
    expect(() => parseBusinessDayCutoff("24:00")).toThrow();
  });

  it("keeps post-midnight activity on the previous business date", () => {
    // Winter offset is UTC+02: 01:59:59Z = 03:59:59 in Hebron.
    expect(businessDateFor(new Date("2026-01-15T01:59:59.000Z"), config)).toBe(
      "2026-01-14",
    );
  });

  it("switches business date exactly at the 04:00 cutoff", () => {
    expect(businessDateFor(new Date("2026-01-15T02:00:00.000Z"), config)).toBe(
      "2026-01-15",
    );
  });

  it("returns exact start and end-exclusive boundaries", () => {
    const bounds = businessDayBoundsFor("2026-01-15", config);
    expect(bounds.start.toISOString()).toBe("2026-01-15T02:00:00.000Z");
    expect(bounds.endExclusive.toISOString()).toBe("2026-01-16T02:00:00.000Z");
    expect(() => businessDayBoundsFor("2026-02-30", config)).toThrow(
      "valid calendar date",
    );
  });

  it("respects the restaurant zone across the summer offset", () => {
    // Summer offset is UTC+03: 00:30Z = 03:30 in Hebron.
    expect(businessDateFor(new Date("2026-08-23T00:30:00.000Z"), config)).toBe(
      "2026-08-22",
    );
    expect(businessDateFor(new Date("2026-08-23T01:00:00.000Z"), config)).toBe(
      "2026-08-23",
    );
  });
});

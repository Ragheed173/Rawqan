import { describe, expect, it } from "vitest";
import {
  currentBusinessDate,
  isoToRestaurantLocal,
  restaurantLocalToIso,
} from "./businessDate";

const state = { timezone: "Asia/Hebron", businessDayCutoff: "04:00" };

describe("offline POS business date", () => {
  it("uses the previous business date before the 04:00 cutoff", () => {
    expect(currentBusinessDate(state, new Date("2026-01-15T01:30:00Z"))).toBe(
      "2026-01-14",
    );
    expect(currentBusinessDate(state, new Date("2026-01-15T02:30:00Z"))).toBe(
      "2026-01-15",
    );
  });

  it("honors daylight-saving offset", () => {
    expect(currentBusinessDate(state, new Date("2026-07-14T23:30:00Z"))).toBe(
      "2026-07-14",
    );
    expect(currentBusinessDate(state, new Date("2026-07-15T01:30:00Z"))).toBe(
      "2026-07-15",
    );
  });
});

describe("restaurant reservation time", () => {
  it("round-trips Asia/Hebron wall time independently of browser timezone", () => {
    const iso = restaurantLocalToIso("2026-08-24T20:30");
    expect(isoToRestaurantLocal(iso)).toBe("2026-08-24T20:30");
  });

  it("round-trips a winter time", () => {
    const iso = restaurantLocalToIso("2026-12-24T20:30");
    expect(isoToRestaurantLocal(iso)).toBe("2026-12-24T20:30");
  });
});

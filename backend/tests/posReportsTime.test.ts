import { describe, expect, it } from "vitest";
import { hourInTimeZone } from "../src/modules/pos/reports.service.js";

describe("POS report business timezone", () => {
  it("uses Asia/Hebron local hour instead of UTC in winter and summer", () => {
    expect(hourInTimeZone(new Date("2026-01-15T10:00:00Z"), "Asia/Hebron")).toBe(12);
    expect(hourInTimeZone(new Date("2026-07-15T10:00:00Z"), "Asia/Hebron")).toBe(13);
  });

  it("handles the DST fallback transition without invalid hours", () => {
    const hours = ["2026-10-23T21:30:00Z", "2026-10-23T22:30:00Z", "2026-10-23T23:30:00Z"].map((instant) => hourInTimeZone(new Date(instant), "Asia/Hebron"));
    expect(hours.every((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)).toBe(true);
  });
});

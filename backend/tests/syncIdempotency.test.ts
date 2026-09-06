import { describe, expect, it } from "vitest";
import { isRetiredShiftOperation } from "../src/modules/pos/sync.service.js";

describe("POS sync idempotent outcomes", () => {
  it("retires legacy shift operations as successful no-ops", () => {
    expect(isRetiredShiftOperation("OPEN_SHIFT")).toBe(true);
    expect(isRetiredShiftOperation("CLOSE_SHIFT")).toBe(true);
  });

  it("does not retire operational commands", () => {
    expect(isRetiredShiftOperation("OPEN_ORDER")).toBe(false);
    expect(isRetiredShiftOperation("FINALIZE_INVOICE")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isAlreadySatisfiedSyncOutcome } from "../src/modules/pos/sync.service.js";

describe("POS sync idempotent outcomes", () => {
  it("accepts a missing shift when replaying a close operation", () => {
    expect(
      isAlreadySatisfiedSyncOutcome("CLOSE_SHIFT", "SHIFT_NOT_OPEN"),
    ).toBe(true);
  });

  it("does not hide unrelated shift or order failures", () => {
    expect(
      isAlreadySatisfiedSyncOutcome("OPEN_SHIFT", "SHIFT_ALREADY_OPEN"),
    ).toBe(false);
    expect(
      isAlreadySatisfiedSyncOutcome("OPEN_ORDER", "ORDER_NOT_FOUND"),
    ).toBe(false);
  });
});

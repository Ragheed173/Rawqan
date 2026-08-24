import { describe, expect, it } from "vitest";
import { formatMinor } from "./format";

describe("POS money formatting", () => {
  it("omits zero decimals while preserving real fractional minor units", () => {
    expect(formatMinor("1500")).toBe("15 ₪");
    expect(formatMinor("1450")).toBe("14.5 ₪");
    expect(formatMinor("1497")).toBe("14.97 ₪");
    expect(formatMinor("-500")).toBe("-5 ₪");
  });
});

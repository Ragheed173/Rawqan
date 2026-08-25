import { describe, expect, it } from "vitest";
import {
  minorToShekelInput,
  normalizeShekelInput,
  shekelInputToMinor,
} from "./moneyInput";

describe("POS shekel inputs", () => {
  it("accepts whole shekels while keeping minor units internally", () => {
    expect(shekelInputToMinor("690")).toBe("69000");
    expect(minorToShekelInput("69000")).toBe("690");
  });

  it("accepts Arabic digits and up to two decimal places", () => {
    expect(normalizeShekelInput("٦٩٠٫٥٠")).toBe("690.50");
    expect(shekelInputToMinor("٦٩٠٫٥٠")).toBe("69050");
    expect(minorToShekelInput("69050")).toBe("690.5");
  });
});

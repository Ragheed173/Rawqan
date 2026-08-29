import { describe, expect, it } from "vitest";
import { checkDatabaseReadiness } from "../src/ops/readiness.js";

describe("database readiness", () => {
  it("reports measured latency after a successful probe", async () => {
    const result = await checkDatabaseReadiness(async () => 1, 250);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("fails within the configured timeout", async () => {
    const neverFinishes = () => new Promise<never>(() => undefined);
    await expect(checkDatabaseReadiness(neverFinishes, 10)).rejects.toThrow(
      "timed out",
    );
  });
});

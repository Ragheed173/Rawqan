import { describe, expect, it } from "vitest";
import { config } from "@/config/env";
import { api } from "./apiClient";

describe("API deadlines", () => {
  it("applies the configured deadline to every API request", () => {
    expect(config.apiTimeoutMs).toBeGreaterThan(0);
    expect(api.defaults.timeout).toBe(config.apiTimeoutMs);
  });
});

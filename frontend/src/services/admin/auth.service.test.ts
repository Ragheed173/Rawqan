import { afterEach, describe, expect, it, vi } from "vitest";
import { api, tokenStore } from "@/lib/apiClient";
import { authService } from "./auth.service";

describe("authService.logout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    tokenStore.set(null);
  });

  it("clears the local access token even when the cashier is offline", async () => {
    tokenStore.set("active-token");
    vi.spyOn(api, "post").mockRejectedValueOnce(new Error("offline"));

    await expect(authService.logout()).resolves.toBeUndefined();
    expect(tokenStore.get()).toBeNull();
  });
});

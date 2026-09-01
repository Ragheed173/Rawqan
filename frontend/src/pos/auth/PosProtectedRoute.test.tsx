import "fake-indexeddb/auto";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { posDb } from "../db/schema";
import { PosProtectedRoute } from "./PosProtectedRoute";

vi.mock("@/store/auth", () => ({
  useAuthStore: () => ({
    status: "loading",
    restore: vi.fn(),
  }),
}));

beforeEach(async () => {
  posDb.close();
  await posDb.delete();
  await posDb.open();
  window.rawaqanDesktop = { isDesktop: true } as RawaqanDesktopBridge;
});

describe("standalone POS startup", () => {
  it("shows the local PIN immediately while cloud session restore is still loading", async () => {
    const payload = {
      version: 2,
      deviceId: "device",
      userId: "cashier",
      role: "CASHIER",
      permissions: ["pos:operate"],
      pinVerifier: {
        algorithm: "PBKDF2-SHA256",
        iterations: 100_000,
        saltBase64: "AAAAAAAAAAAAAAAAAAAAAA==",
        hashBase64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      },
      issuedAt: new Date(Date.now() - 120_000).toISOString(),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    };
    await posDb.offlineSession.put({
      id: "device:cashier",
      deviceId: "device",
      userId: "cashier",
      role: "CASHIER",
      permissions: ["pos:operate"],
      capability: `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`,
      expiresAt: payload.expiresAt,
    });

    render(
      <MemoryRouter initialEntries={["/pos"]}>
        <Routes>
          <Route path="/pos" element={<PosProtectedRoute />}>
            <Route index element={<div>POS ready</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("فتح POS دون اتصال")).toBeInTheDocument();
    expect(screen.queryByText("جارٍ التحقق…")).not.toBeInTheDocument();
  });
});

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { posDb } from "../db/schema";
import {
  orderDueOperations,
  reconcileCurrentShift,
  recoverInterruptedOperations,
} from "./engine";

beforeEach(async () => { posDb.close(); await posDb.delete(); await posDb.open(); });

describe("POS sync recovery", () => {
  it("requeues an operation left SYNCING by a browser restart", async () => {
    await posDb.syncOperations.put({ operationId: "op", deviceId: "device", localSequence: "1", requestHash: "hash", operationType: "OPEN_ORDER", payload: {}, dependencies: [], status: "SYNCING", attempts: 1, createdAt: new Date().toISOString() });
    await recoverInterruptedOperations();
    expect(await posDb.syncOperations.get("op")).toMatchObject({ status: "FAILED", errorCode: "SYNC_INTERRUPTED", nextAttemptAt: expect.any(String) });
  });

  it("removes a stale local open shift when the server has none", async () => {
    await posDb.shifts.put({
      id: "stale-shift",
      userId: "cashier",
      deviceId: "device",
      status: "OPEN",
      openingCashMinor: "0",
      expectedCashMinor: "0",
    });
    await reconcileCurrentShift(null);
    expect(await posDb.shifts.get("stale-shift")).toBeUndefined();
  });

  it("keeps an offline shift that still has an unsynced OPEN_SHIFT operation", async () => {
    await posDb.shifts.put({
      id: "offline-shift",
      userId: "cashier",
      deviceId: "device",
      status: "OPEN",
      openingCashMinor: "0",
      expectedCashMinor: "0",
    });
    await posDb.syncOperations.put({
      operationId: "open-shift-op",
      deviceId: "device",
      localSequence: "2",
      requestHash: "hash",
      operationType: "OPEN_SHIFT",
      payload: { id: "offline-shift", openingCashMinor: "0" },
      dependencies: [],
      status: "FAILED",
      attempts: 1,
      errorCode: "BACKEND_UNAVAILABLE",
      createdAt: new Date().toISOString(),
    });
    await reconcileCurrentShift(null);
    expect(await posDb.shifts.get("offline-shift")).toBeDefined();
  });

  it("sends a replacement OPEN_SHIFT before an older payment blocked by SHIFT_REQUIRED", () => {
    const base = {
      deviceId: "device",
      requestHash: "hash",
      payload: {},
      dependencies: [],
      status: "FAILED" as const,
      attempts: 1,
      createdAt: new Date().toISOString(),
    };
    const blocked = {
      ...base,
      operationId: "payment",
      localSequence: "3",
      operationType: "FINALIZE_INVOICE",
      errorCode: "SHIFT_REQUIRED",
    };
    const openShift = {
      ...base,
      operationId: "shift",
      localSequence: "4",
      operationType: "OPEN_SHIFT",
      status: "PENDING" as const,
    };
    expect(orderDueOperations([blocked, openShift])).toEqual([
      openShift,
      blocked,
    ]);
  });
});

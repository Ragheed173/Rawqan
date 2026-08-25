import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { posDb } from "../db/schema";
import {
  orderDueOperations,
  applyBootstrap,
  reconcileCurrentShift,
  reconcileLocalSequence,
  recoverInterruptedOperations,
} from "./engine";

beforeEach(async () => { posDb.close(); await posDb.delete(); await posDb.open(); });

describe("POS sync recovery", () => {
  it("restores an active server order and its items after a page reload", async () => {
    await posDb.deviceState.put({
      key: "primary",
      deviceId: "device",
      deviceCode: "P01",
      nextLocalSequence: "1",
      invoiceYear: 2026,
      nextInvoiceSequence: 1,
      catalogRevision: "0",
    });

    await applyBootstrap({
      device: { id: "device", code: "P01" },
      nextLocalSequence: "1",
      catalog: {
        revision: "1",
        categories: [],
        menuItems: [],
        modifierGroups: [],
        menuItemModifierGroups: [],
      },
      tables: [
        {
          id: "table",
          code: "T01",
          status: "BILL_REQUESTED",
          isActive: true,
          sortOrder: 1,
          orderAssignments: [
            {
              id: "assignment",
              orderId: "order",
              tableId: "table",
              assignedAt: "2026-08-25T00:00:00.000Z",
              isPrimary: true,
              order: {
                id: "order",
                status: "BILL_REQUESTED",
                version: 2,
                businessDate: "2026-08-25T00:00:00.000Z",
                deviceId: "device",
                openedById: "cashier",
                openedAt: "2026-08-25T00:00:00.000Z",
                items: [
                  {
                    id: "item",
                    orderId: "order",
                    menuItemId: "latte",
                    itemNameSnapshot: "لاتيه روقان",
                    unitPriceMinor: "1500",
                    quantity: 1,
                    lineTotalMinor: "1500",
                    sortOrder: 0,
                    modifiers: [],
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(await posDb.restaurantTables.get("table")).toMatchObject({
      currentOrderId: "order",
    });
    expect(await posDb.orders.get("order")).toMatchObject({
      status: "BILL_REQUESTED",
      version: 2,
    });
    expect(await posDb.orderItems.get("item")).toMatchObject({
      itemNameSnapshot: "لاتيه روقان",
      lineTotalMinor: "1500",
    });
  });

  it("rebases unfinished operations after browser storage is reset", async () => {
    await posDb.deviceState.put({
      key: "primary",
      deviceId: "device",
      deviceCode: "P01",
      nextLocalSequence: "3",
      invoiceYear: 2026,
      nextInvoiceSequence: 1,
      catalogRevision: "0",
    });
    await posDb.syncOperations.bulkPut([
      {
        operationId: "open-shift",
        deviceId: "device",
        localSequence: "1",
        requestHash: "hash-1",
        operationType: "OPEN_SHIFT",
        payload: { id: "shift" },
        dependencies: [],
        status: "FAILED",
        attempts: 5,
        errorCode: "CONFLICT",
        createdAt: new Date().toISOString(),
      },
      {
        operationId: "close-shift",
        deviceId: "device",
        localSequence: "2",
        requestHash: "hash-2",
        operationType: "CLOSE_SHIFT",
        payload: { id: "shift" },
        dependencies: [],
        status: "FAILED",
        attempts: 1,
        errorCode: "CONFLICT",
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(await reconcileLocalSequence("device", "5")).toBe("7");
    expect(await posDb.deviceState.get("primary")).toMatchObject({
      nextLocalSequence: "3",
    });
    expect(
      (await posDb.syncOperations.toArray())
        .sort((a, b) =>
          BigInt(a.localSequence) < BigInt(b.localSequence) ? -1 : 1,
        )
        .map((operation) => ({
          id: operation.operationId,
          sequence: operation.localSequence,
          status: operation.status,
          code: operation.errorCode,
        })),
    ).toEqual([
      { id: "open-shift", sequence: "5", status: "PENDING", code: undefined },
      { id: "close-shift", sequence: "6", status: "PENDING", code: undefined },
    ]);
  });

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

import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosDatabase, posDb } from "../db/schema";
import {
  addLocalOrderItem,
  cancelLocalOrder,
  checkoutLocal,
  createLocalReservation,
  finalizeLocalEqualSplit,
  finalizeLocalItemSplit,
  mergeLocalOrders,
  openLocalOrder,
  payLocalInvoice,
  recordLocalPrintEvent,
  reopenLocalOrder,
} from "./localCommands";
import { priceLine } from "../domain/pricing";
import { splitMinorEqual } from "../types";
import { renderReceiptHtml } from "../printing/ReceiptPrinter";

beforeEach(async () => {
  vi.stubGlobal("crypto", webcrypto);
  posDb.close();
  await posDb.delete();
  await posDb.open();
  await posDb.deviceState.put({
    key: "primary",
    deviceId: "11111111-1111-4111-8111-111111111111",
    deviceCode: "P01",
    nextLocalSequence: "1",
    invoiceYear: 2026,
    nextInvoiceSequence: 1,
    catalogRevision: "0",
  });
  await posDb.restaurantTables.put({
    id: "22222222-2222-4222-8222-222222222222",
    code: "T01",
    status: "AVAILABLE",
    isActive: true,
    sortOrder: 1,
  });
});

describe("local-first POS commands", () => {
  it("cancels an order offline and releases its table", async () => {
    const { result: orderId } = await openLocalOrder({
      tableId: "22222222-2222-4222-8222-222222222222",
      userId: "cashier",
      businessDate: "2026-08-25",
    });

    await cancelLocalOrder(orderId);

    expect(await posDb.orders.get(orderId)).toMatchObject({
      status: "CANCELLED",
      version: 2,
      closedAt: expect.any(String),
    });
    expect(
      await posDb.restaurantTables.get(
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toMatchObject({ status: "AVAILABLE", currentOrderId: null });
    expect(
      (await posDb.syncOperations.toArray()).find(
        (operation) => operation.operationType === "CANCEL_ORDER",
      ),
    ).toMatchObject({
      operationType: "CANCEL_ORDER",
      payload: { id: orderId, expectedVersion: 1 },
    });
  });

  it("reopens a bill-requested order and restores its table for editing", async () => {
    await posDb.orders.put({
      id: "order-reopen",
      status: "BILL_REQUESTED",
      version: 2,
      businessDate: "2026-08-25",
      deviceId: "11111111-1111-4111-8111-111111111111",
      openedById: "cashier",
      openedAt: "2026-08-25T00:00:00.000Z",
    });
    await posDb.orderTables.put({
      id: "assignment-reopen",
      orderId: "order-reopen",
      tableId: "22222222-2222-4222-8222-222222222222",
      assignedAt: "2026-08-25T00:00:00.000Z",
      isPrimary: true,
    });
    await posDb.restaurantTables.update(
      "22222222-2222-4222-8222-222222222222",
      { status: "BILL_REQUESTED", currentOrderId: "order-reopen" },
    );

    await reopenLocalOrder("order-reopen");

    expect(await posDb.orders.get("order-reopen")).toMatchObject({
      status: "OPEN",
      version: 3,
    });
    expect(
      await posDb.restaurantTables.get(
        "22222222-2222-4222-8222-222222222222",
      ),
    ).toMatchObject({ status: "OCCUPIED" });
    expect((await posDb.syncOperations.toArray()).at(-1)).toMatchObject({
      operationType: "REOPEN_ORDER",
      payload: { id: "order-reopen", expectedVersion: 2 },
    });
  });

  it("records initial and reprint receipt events in the offline outbox", async () => {
    await posDb.invoices.put({
      id: "invoice-print",
      invoiceNumber: "RWQ-P01-2026-000001",
      orderId: "order-print",
      status: "PAID",
      businessDate: "2026-08-25",
      subtotalMinor: "1500",
      discountMinor: "0",
      totalMinor: "1500",
      refundedMinor: "0",
      cashierId: "cashier",
      deviceId: "11111111-1111-4111-8111-111111111111",
      issuedAt: "2026-08-25T00:00:00.000Z",
    });

    await recordLocalPrintEvent("invoice-print", "INITIAL", "80mm");
    await recordLocalPrintEvent("invoice-print", "REPRINT", "58mm");

    const events = await posDb.receiptPrintEvents
      .where("invoiceId")
      .equals("invoice-print")
      .sortBy("createdAt");
    expect(events.map(({ type, paperWidthMm }) => ({ type, paperWidthMm }))).toEqual([
      { type: "INITIAL", paperWidthMm: 80 },
      { type: "REPRINT", paperWidthMm: 58 },
    ]);
    const operations = await posDb.syncOperations
      .where("status")
      .equals("PENDING")
      .toArray();
    expect(operations.map((operation) => operation.operationType)).toEqual([
      "PRINT_EVENT",
      "PRINT_EVENT",
    ]);
  });

  it("atomically opens an order and appends its outbox operation", async () => {
    const { result: orderId } = await openLocalOrder({
      tableId: "22222222-2222-4222-8222-222222222222",
      userId: "admin",
      businessDate: "2026-08-24",
    });
    expect((await posDb.orders.get(orderId))?.status).toBe("OPEN");
    expect(
      (await posDb.restaurantTables.get("22222222-2222-4222-8222-222222222222"))
        ?.currentOrderId,
    ).toBe(orderId);
    expect(await posDb.syncOperations.count()).toBe(1);
  });

  it("reads cached boolean availability without relying on unsupported IndexedDB boolean keys", async () => {
    await posDb.menuItems.bulkPut([
      {
        id: "available",
        categoryId: "c",
        name: "متاح",
        priceMinor: "100",
        isAvailable: true,
        isArchived: false,
        sortOrder: 1,
      },
      {
        id: "hidden",
        categoryId: "c",
        name: "مخفي",
        priceMinor: "100",
        isAvailable: false,
        isArchived: false,
        sortOrder: 2,
      },
    ]);
    const available = await posDb.menuItems
      .toCollection()
      .filter((item) => item.isAvailable && !item.isArchived)
      .toArray();
    expect(available.map((item) => item.id)).toEqual(["available"]);
  });

  it("rolls back local state and outbox together when a mutation fails", async () => {
    await posDb.restaurantTables.update(
      "22222222-2222-4222-8222-222222222222",
      { currentOrderId: "existing", status: "OCCUPIED" },
    );
    await expect(
      openLocalOrder({
        tableId: "22222222-2222-4222-8222-222222222222",
        userId: "admin",
        businessDate: "2026-08-24",
      }),
    ).rejects.toThrow("TABLE_OCCUPIED");
    expect(await posDb.orders.count()).toBe(0);
    expect(await posDb.syncOperations.count()).toBe(0);
  });

  it("prices replacements/add-ons and checks out offline without losing precision", async () => {
    const priced = priceLine("2500", 1, [
      { groupType: "VARIANT", priceType: "REPLACEMENT", priceMinor: "3200" },
      { groupType: "ADD_ON", priceType: "DELTA", priceMinor: "300" },
    ]);
    expect(priced.unitPriceMinor).toBe("3500");
    expect(splitMinorEqual("10000", 3)).toEqual(["3334", "3333", "3333"]);
    const { result: orderId } = await openLocalOrder({
      tableId: "22222222-2222-4222-8222-222222222222",
      userId: "admin",
      businessDate: "2026-08-24",
    });
    await addLocalOrderItem({
      orderId,
      menuItemId: "menu",
      itemNameSnapshot: "برغر",
      unitPriceMinor: priced.unitPriceMinor,
      quantity: 1,
    });
    await posDb.shifts.put({
      id: "shift",
      userId: "admin",
      deviceId: "11111111-1111-4111-8111-111111111111",
      status: "OPEN",
      openingCashMinor: "0",
      expectedCashMinor: "0",
    });
    const { result: invoice } = await checkoutLocal({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      payments: [
        { method: "CASH", amountMinor: "3500", tenderedMinor: "4000" },
      ],
    });
    expect(invoice.invoiceNumber).toBe("RWQ-P01-2026-000001");
    expect(
      (await posDb.payments.where("invoiceId").equals(invoice.id).first())
        ?.changeMinor,
    ).toBe("500");
    expect(await posDb.syncOperations.count()).toBe(3);
  });

  async function equalOrder(
    quantity: number,
    unitPriceMinor: string,
    secondItem = false,
  ) {
    const { result: orderId } = await openLocalOrder({
      tableId: "22222222-2222-4222-8222-222222222222",
      userId: "admin",
      businessDate: "2026-08-24",
    });
    await addLocalOrderItem({
      orderId,
      menuItemId: "menu-a",
      itemNameSnapshot: "برغر",
      unitPriceMinor,
      quantity,
    });
    if (secondItem)
      await addLocalOrderItem({
        orderId,
        menuItemId: "menu-b",
        itemNameSnapshot: "سلطة",
        unitPriceMinor: "1250",
        quantity: 1,
      });
    return orderId;
  }

  it("persists one item divided exactly across two local invoices", async () => {
    const orderId = await equalOrder(1, "3000");
    const { result } = await finalizeLocalEqualSplit({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      splitCount: 2,
    });
    expect(result.invoices.map((invoice) => invoice.totalMinor)).toEqual([
      "1500",
      "1500",
    ]);
    expect(
      (await posDb.invoiceAllocationLines.toArray()).map((line) => [
        line.quantityNumerator,
        line.quantityDenominator,
      ]),
    ).toEqual([
      ["1", "2"],
      ["1", "2"],
    ]);
  });

  it("pays split siblings locally and closes the order only after the last share", async () => {
    const orderId = await equalOrder(1, "3000");
    await posDb.shifts.put({
      id: "split-shift",
      userId: "admin",
      deviceId: "11111111-1111-4111-8111-111111111111",
      status: "OPEN",
      openingCashMinor: "0",
      cashSalesMinor: "0",
      expectedCashMinor: "0",
    });
    const { result } = await finalizeLocalEqualSplit({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      splitCount: 2,
    });
    await payLocalInvoice({
      invoiceId: result.invoices[0]!.id,
      userId: "admin",
      method: "CASH",
      amountMinor: "1500",
      tenderedMinor: "1500",
    });
    expect((await posDb.orders.get(orderId))?.status).toBe("PARTIALLY_BILLED");
    await payLocalInvoice({
      invoiceId: result.invoices[1]!.id,
      userId: "admin",
      method: "CASH",
      amountMinor: "1500",
      tenderedMinor: "2000",
    });
    expect((await posDb.orders.get(orderId))?.status).toBe("CLOSED");
    expect(
      (await posDb.restaurantTables.get("22222222-2222-4222-8222-222222222222"))
        ?.status,
    ).toBe("AVAILABLE");
    const operation = await posDb.syncOperations
      .filter(
        (row) =>
          row.operationType === "CREATE_PAYMENT" &&
          row.payload.method === "CASH" &&
          row.payload.invoiceId === result.invoices[0]!.id,
      )
      .first();
    expect(operation?.payload).toMatchObject({
      invoiceId: result.invoices[0]!.id,
      method: "CASH",
      amountMinor: "1500",
    });
  });

  it("uses deterministic 10000 / 3 money and exact 1/3 quantities", async () => {
    const orderId = await equalOrder(1, "10000");
    const { result } = await finalizeLocalEqualSplit({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      splitCount: 3,
    });
    expect(result.invoices.map((invoice) => invoice.totalMinor)).toEqual([
      "3334",
      "3333",
      "3333",
    ]);
    expect(
      (await posDb.invoiceAllocationLines.toArray()).every(
        (line) =>
          line.quantityNumerator === "1" && line.quantityDenominator === "3",
      ),
    ).toBe(true);
  });

  it("keeps quantity 2 / 3 rational values in the sync payload", async () => {
    const orderId = await equalOrder(2, "1500");
    await finalizeLocalEqualSplit({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      splitCount: 3,
    });
    const operation = await posDb.syncOperations
      .filter((row) => row.operationType === "FINALIZE_EQUAL_SPLIT")
      .first();
    const allocations = (
      operation!.payload.invoices as {
        allocations: {
          quantityNumerator: string;
          quantityDenominator: string;
        }[];
      }[]
    ).flatMap((invoice) => invoice.allocations);
    expect(allocations).toHaveLength(3);
    expect(
      allocations.every(
        (allocation) =>
          allocation.quantityNumerator === "2" &&
          allocation.quantityDenominator === "3",
      ),
    ).toBe(true);
  });

  it("preserves multiple item and modifier snapshots on every sibling", async () => {
    const orderId = await equalOrder(1, "3000", true);
    const burger = await posDb.orderItems
      .where("orderId")
      .equals(orderId)
      .first();
    await posDb.orderItemModifiers.add({
      id: crypto.randomUUID(),
      orderItemId: burger!.id,
      groupNameSnapshot: "إضافات",
      optionNameSnapshot: "جبنة",
      priceTypeSnapshot: "DELTA",
      unitPriceMinor: "200",
      quantity: 1,
      lineTotalMinor: "200",
    });
    await finalizeLocalEqualSplit({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      splitCount: 2,
    });
    expect(await posDb.invoiceAllocationLines.count()).toBe(4);
    expect(await posDb.invoiceAllocationModifiers.count()).toBe(2);
    expect(
      (await posDb.invoiceAllocationModifiers.toArray()).every(
        (row) => row.optionNameSnapshot === "جبنة",
      ),
    ).toBe(true);
  });

  it("creates an ordered offline ITEM split without losing line snapshots", async () => {
    const orderId = await equalOrder(1, "3000", true);
    const orderItems = await posDb.orderItems
      .where("orderId")
      .equals(orderId)
      .sortBy("sortOrder");
    const splitGroupId = crypto.randomUUID();
    const first = await finalizeLocalItemSplit({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      lines: [{ orderItemId: orderItems[0]!.id, quantity: 1 }],
      splitGroupId,
      splitIndex: 1,
      splitCount: 2,
    });
    await finalizeLocalItemSplit({
      orderId,
      userId: "admin",
      businessDate: "2026-08-24",
      lines: [{ orderItemId: orderItems[1]!.id, quantity: 1 }],
      splitGroupId,
      splitIndex: 2,
      splitCount: 2,
      dependencies: [first.operation.operationId],
    });
    expect(
      (await posDb.invoices.toArray())
        .sort((a, b) => (a.splitIndex ?? 0) - (b.splitIndex ?? 0))
        .map((invoice) => [invoice.splitMode, invoice.totalMinor]),
    ).toEqual([
      ["ITEM", "3000"],
      ["ITEM", "1250"],
    ]);
    const operations = await posDb.syncOperations
      .filter((operation) => operation.operationType === "FINALIZE_INVOICE")
      .sortBy("localSequence");
    expect(operations[1]!.dependencies).toEqual([operations[0]!.operationId]);
  });

  it("rejects overlapping offline reservations on the same table", async () => {
    const common = {
      customerName: "أحمد",
      phone: "0590000000",
      guestCount: 2,
      startsAt: "2026-08-24T17:00:00.000Z",
      status: "CONFIRMED",
      tableIds: ["22222222-2222-4222-8222-222222222222"],
    };
    await createLocalReservation(common);
    await expect(
      createLocalReservation({
        ...common,
        customerName: "ليلى",
        startsAt: "2026-08-24T17:30:00.000Z",
      }),
    ).rejects.toThrow("RESERVATION_OVERLAP");
    expect(await posDb.reservations.count()).toBe(1);
    expect(
      await posDb.syncOperations
        .filter((operation) => operation.operationType === "CREATE_RESERVATION")
        .count(),
    ).toBe(1);
  });

  it("repoints every merged table to the surviving local order", async () => {
    await posDb.restaurantTables.put({
      id: "33333333-3333-4333-8333-333333333333",
      code: "T02",
      status: "AVAILABLE",
      isActive: true,
      sortOrder: 2,
    });
    const first = await openLocalOrder({
      tableId: "22222222-2222-4222-8222-222222222222",
      userId: "admin",
      businessDate: "2026-08-24",
    });
    const second = await openLocalOrder({
      tableId: "33333333-3333-4333-8333-333333333333",
      userId: "admin",
      businessDate: "2026-08-24",
    });
    await mergeLocalOrders(first.result, [second.result]);
    expect(
      (await posDb.restaurantTables.get("33333333-3333-4333-8333-333333333333"))
        ?.currentOrderId,
    ).toBe(first.result);
    expect((await posDb.orders.get(second.result))?.status).toBe("MERGED");
  });

  it("renders split metadata and a rational share without a fake whole quantity", () => {
    const invoice = {
      id: "i",
      invoiceNumber: "RWQ-P01-2026-000001",
      orderId: "o",
      status: "OPEN" as const,
      businessDate: "2026-08-24",
      subtotalMinor: "1000",
      discountMinor: "0",
      totalMinor: "1000",
      refundedMinor: "0",
      cashierId: "a",
      deviceId: "d",
      issuedAt: "now",
      splitGroupId: "g",
      splitMode: "EQUAL" as const,
      splitIndex: 1,
      splitCount: 3,
    };
    const html = renderReceiptHtml({
      restaurantName: "روقان",
      invoice,
      tableNames: [],
      cashierName: "كاشير",
      items: [],
      payments: [],
      allocationLines: [
        {
          id: "l",
          invoiceId: "i",
          orderItemId: "oi",
          itemNameSnapshot: "برغر",
          unitPriceMinor: "3000",
          quantityNumerator: "1",
          quantityDenominator: "3",
          subtotalMinor: "1000",
          discountMinor: "0",
          totalMinor: "1000",
          sortOrder: 0,
        },
      ],
    });
    expect(html).toContain("1 من 3");
    expect(html).toContain("حصة 1/3");
    expect(html).not.toContain("× 1");
  });

  it("renders normal immutable invoice lines, Arabic modifiers, cash change and reprint marking", () => {
    const invoice = {
      id: "i",
      invoiceNumber: "RWQ-P01-2026-000002",
      orderId: "o",
      status: "PAID" as const,
      businessDate: "2026-08-24",
      subtotalMinor: "3500",
      discountMinor: "0",
      totalMinor: "3500",
      refundedMinor: "0",
      cashierId: "a",
      deviceId: "d",
      issuedAt: "now",
    };
    const html = renderReceiptHtml({
      restaurantName: "روقان",
      invoice,
      tableNames: ["طاولة 1"],
      cashierName: "كاشير",
      items: [
        {
          id: "line",
          invoiceId: "i",
          orderItemId: "oi",
          itemNameSnapshot: "برغر طويل الاسم",
          unitPriceMinor: "3500",
          quantity: 1,
          subtotalMinor: "3500",
          discountMinor: "0",
          totalMinor: "3500",
          sortOrder: 0,
        },
      ],
      modifiers: [
        {
          id: "m",
          invoiceLineId: "line",
          groupNameSnapshot: "إضافات",
          optionNameSnapshot: "جبنة إضافية",
          priceTypeSnapshot: "DELTA",
          unitPriceMinor: "500",
          quantity: 1,
          totalMinor: "500",
        },
      ],
      payments: [
        {
          id: "p",
          invoiceId: "i",
          method: "CASH",
          amountMinor: "3500",
          tenderedMinor: "4000",
          changeMinor: "500",
          status: "COMPLETED",
          paidAt: "now",
        },
      ],
      isReprint: true,
    });
    expect(html).toContain("برغر طويل الاسم");
    expect(html).toContain("جبنة إضافية");
    expect(html).toContain("الباقي: 5 ₪");
    expect(html).toContain("نسخة معاد طباعتها");
  });

  it("upgrades a version-1 Dexie database without losing existing POS rows", async () => {
    const name = `rawaqan-pos-migration-${crypto.randomUUID()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({ orders: "id, status, businessDate, openedAt" });
    await legacy.open();
    await legacy
      .table("orders")
      .put({
        id: "legacy-order",
        status: "OPEN",
        businessDate: "2026-08-24",
        openedAt: "now",
      });
    legacy.close();
    const upgraded = new PosDatabase(name);
    await upgraded.open();
    expect((await upgraded.orders.get("legacy-order"))?.status).toBe("OPEN");
    expect(upgraded.invoiceAllocationLines).toBeDefined();
    upgraded.close();
    await upgraded.delete();
  });
});

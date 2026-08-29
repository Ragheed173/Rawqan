import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import {
  addOrderItem,
  applyOrderDiscount,
  closeShift,
  createPayment,
  createReservation,
  finalizeEqualSplit,
  finalizeInvoice,
  mergeOrders,
  openOrder,
  openShift,
  refundInvoice,
  transferOrder,
  updateReservation,
  voidInvoice,
} from "../src/modules/pos/pos.commands.js";
import { pushOperations } from "../src/modules/pos/sync.service.js";
import { hashOperationRequest } from "../src/domain/pos/operations.js";
import { buildSalesReport } from "../src/modules/pos/reports.service.js";

const fixture = { actorId: "", deviceId: "", menuItemId: "", categoryId: "" };

beforeAll(async () => {
  const suffix = randomUUID();
  const [actor, device, category] = await Promise.all([
    prisma.admin.create({ data: { email: `pos-${suffix}@test.local`, passwordHash: "not-used", name: "POS Command Test", role: "SUPER_ADMIN" } }),
    prisma.posDevice.create({ data: { code: `P${suffix.slice(0, 6)}`, name: "Command Test" } }),
    prisma.category.create({ data: { slug: `pos-${suffix}`, name: "POS Test" } }),
  ]);
  const item = await prisma.menuItem.create({ data: { categoryId: category.id, slug: `item-${suffix}`, name: "Burger", price: "25.00" } });
  fixture.actorId = actor.id; fixture.deviceId = device.id; fixture.menuItemId = item.id;
  fixture.categoryId = category.id;
  await openShift({ openingCashMinor: 1000n }, { actorId: actor.id, deviceId: device.id });
});

async function orderWithItem() {
  const table = await prisma.diningTable.create({ data: { code: `T-${randomUUID()}` } });
  const order = await openOrder({ tableId: table.id }, fixture);
  await addOrderItem(order.id, { expectedVersion: 1, menuItemId: fixture.menuItemId, quantity: 2 }, fixture);
  return { table, orderId: order.id };
}

async function customItem(price: string, name = "Split item") {
  const suffix = randomUUID();
  return prisma.menuItem.create({ data: { categoryId: fixture.categoryId, slug: `split-${suffix}`, name: `${name}-${suffix.slice(0, 6)}`, price } });
}

async function orderWithCustomItem(quantity: number, price: string, modifierOptionIds: string[] = []) {
  const item = await customItem(price); const table = await prisma.diningTable.create({ data: { code: `S-${randomUUID()}` } });
  const order = await openOrder({ tableId: table.id }, fixture);
  await addOrderItem(order.id, { expectedVersion: 1, menuItemId: item.id, quantity, modifierOptionIds }, fixture);
  return { item, table, orderId: order.id };
}

describe("transactional POS commands on PostgreSQL", () => {
  it("finalizes an immutable cash invoice and releases its table", async () => {
    const { table, orderId } = await orderWithItem();
    const invoice = await finalizeInvoice({ orderId, expectedVersion: 2, invoiceNumber: `RWQ-${(await prisma.posDevice.findUniqueOrThrow({ where: { id: fixture.deviceId } })).code}-2026-000001`, payments: [{ method: "CASH", amountMinor: 5000n, tenderedMinor: 6000n }] }, fixture);
    expect(invoice.status).toBe("PAID"); expect(invoice.totalMinor).toBe(5000n); expect(invoice.payments[0]?.changeMinor).toBe(1000n);
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe("AVAILABLE");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CLOSED");
  });

  it("rolls back invoice creation when payment allocation is invalid", async () => {
    const { orderId } = await orderWithItem(); const before = await prisma.invoice.count();
    await expect(finalizeInvoice({ orderId, expectedVersion: 2, payments: [{ method: "VISA", amountMinor: 5001n }] }, fixture)).rejects.toMatchObject({ code: "INVALID_PAYMENT_TOTAL" });
    expect(await prisma.invoice.count()).toBe(before); expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("OPEN");
  });

  it("allocates the next canonical invoice number when an offline number collides", async () => {
    const first = await orderWithItem(); const device = await prisma.posDevice.findUniqueOrThrow({ where: { id: fixture.deviceId } }); const invoiceNumber = `RWQ-${device.code}-2026-000002`;
    await finalizeInvoice({ orderId: first.orderId, expectedVersion: 2, invoiceNumber, payments: [{ method: "VISA", amountMinor: 5000n }] }, fixture);
    const second = await orderWithItem(); const reassigned = await finalizeInvoice({ orderId: second.orderId, expectedVersion: 2, invoiceNumber, payments: [{ method: "VISA", amountMinor: 5000n }] }, fixture);
    expect(reassigned.invoiceNumber).not.toBe(invoiceNumber);
    expect(reassigned.invoiceNumber).toMatch(new RegExp(`^RWQ-${device.code}-2026-\\d{6}$`));
    expect(await prisma.invoice.count({ where: { invoiceNumber: { in: [invoiceNumber, reassigned.invoiceNumber] } } })).toBe(2);
  });

  it("returns the saved result when the same sync operation is retried", async () => {
    const table = await prisma.diningTable.create({ data: { code: `T-${randomUUID()}` } }); const operationId = randomUUID(); const payload = { id: randomUUID(), tableId: table.id }; const dependencies: string[] = []; const requestHash = hashOperationRequest({ operationType: "OPEN_ORDER", payload, dependencies });
    const operation = { operationId, localSequence: 900_000n + BigInt(Math.floor(Math.random() * 10_000)), requestHash, operationType: "OPEN_ORDER", payload, dependencies };
    const first = await pushOperations(fixture.actorId, fixture.deviceId, [operation]); const second = await pushOperations(fixture.actorId, fixture.deviceId, [operation]);
    expect(second).toEqual(first); expect(await prisma.order.count({ where: { id: payload.id } })).toBe(1);
  });

  it("persists exact rational allocations for quantity 1 split by 2 and 3", async () => {
    for (const splitCount of [2, 3]) {
      const { orderId } = await orderWithCustomItem(1, "30.00"); const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount }, fixture);
      expect(split.invoices).toHaveLength(splitCount);
      expect(split.invoices.flatMap((invoice) => invoice.allocationLines).every((line) => line.quantityNumerator === 1n && line.quantityDenominator === BigInt(splitCount))).toBe(true);
      expect(split.invoices.reduce((sum, invoice) => sum + invoice.totalMinor, 0n)).toBe(3000n);
    }
  });

  it("persists generalized quantity 2/3 and deterministic 10000 minor allocation", async () => {
    const { orderId } = await orderWithCustomItem(2, "50.00"); const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount: 3 }, fixture);
    expect(split.invoices.map((invoice) => invoice.totalMinor)).toEqual([3334n, 3333n, 3333n]);
    expect(split.invoices.flatMap((invoice) => invoice.allocationLines).map((line) => [line.quantityNumerator, line.quantityDenominator])).toEqual([[2n, 3n], [2n, 3n], [2n, 3n]]);
  });

  it("closes the order only after every equal-split sibling is paid", async () => {
    const { orderId, table } = await orderWithCustomItem(1, "30.00"); const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount: 3 }, fixture);
    await createPayment(split.invoices[0]!.id, { method: "VISA", amountMinor: 1000n }, fixture); expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PARTIALLY_BILLED");
    await createPayment(split.invoices[1]!.id, { method: "VISA", amountMinor: 1000n }, fixture); expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PARTIALLY_BILLED");
    await createPayment(split.invoices[2]!.id, { method: "VISA", amountMinor: 1000n }, fixture); expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CLOSED"); expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: table.id } })).status).toBe("AVAILABLE");
  });

  it("copies modifier snapshots to every equal-split sibling", async () => {
    const group = await prisma.modifierGroup.create({ data: { type: "ADD_ON", name: "Extras", maxSelections: 2 } });
    const option = await prisma.modifierOption.create({ data: { groupId: group.id, name: "Cheese", price: "2.00" } });
    const item = await customItem("30.00", "Modified"); await prisma.menuItemModifierGroup.create({ data: { menuItemId: item.id, groupId: group.id } });
    const table = await prisma.diningTable.create({ data: { code: `M-${randomUUID()}` } }); const order = await openOrder({ tableId: table.id }, fixture);
    await addOrderItem(order.id, { expectedVersion: 1, menuItemId: item.id, quantity: 1, modifierOptionIds: [option.id] }, fixture);
    const split = await finalizeEqualSplit({ orderId: order.id, expectedVersion: 2, splitCount: 3 }, fixture);
    expect(split.invoices.flatMap((invoice) => invoice.allocationLines.flatMap((line) => line.modifiers))).toHaveLength(3);
    expect(split.invoices.every((invoice) => invoice.allocationLines[0]?.modifiers[0]?.optionNameSnapshot === "Cheese")).toBe(true);
  });

  it("reports equal-split quantity and revenue exactly once", async () => {
    const { item, orderId } = await orderWithCustomItem(1, "30.00", []); const payments = [1000n, 1000n, 1000n].map((amountMinor) => [{ method: "VISA" as const, amountMinor }]);
    const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount: 3, invoices: payments.map((rows) => ({ payments: rows })) }, fixture);
    const date = split.invoices[0]!.businessDate.toISOString().slice(0, 10); const report = await buildSalesReport({ from: date, to: date }); const row = report.topItems.find((entry) => entry.id === item.id);
    expect(row?.quantityNumerator).toBe(1n); expect(row?.quantityDenominator).toBe(1n); expect(row?.revenueMinor).toBe(3000n);
  });

  it("keeps whole-quantity ITEM split invoices natural and rejects over-allocation", async () => {
    const { orderId } = await orderWithCustomItem(2, "25.00"); const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId } }); const groupId = randomUUID();
    const first = await finalizeInvoice({ orderId, expectedVersion: 2, lines: [{ orderItemId: item.id, quantity: 1 }], split: { groupId, index: 1, count: 2 } }, fixture);
    expect(first.splitMode).toBe("ITEM"); expect(first.lines[0]?.quantity).toBe(1);
    await expect(finalizeInvoice({ orderId, expectedVersion: 3, lines: [{ orderItemId: item.id, quantity: 2 }], split: { groupId, index: 2, count: 2 } }, fixture)).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    const second = await finalizeInvoice({ orderId, expectedVersion: 3, lines: [{ orderItemId: item.id, quantity: 1 }], split: { groupId, index: 2, count: 2 } }, fixture);
    expect(second.lines[0]?.quantity).toBe(1);
  });

  it("refunds one paid equal-split invoice without mutating its sibling", async () => {
    const { orderId } = await orderWithCustomItem(1, "30.00"); const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount: 2, invoices: [{ payments: [{ method: "VISA", amountMinor: 1500n }] }, { payments: [{ method: "VISA", amountMinor: 1500n }] }] }, fixture);
    const siblingBefore = await prisma.invoice.findUniqueOrThrow({ where: { id: split.invoices[1]!.id } });
    await refundInvoice(split.invoices[0]!.id, { amountMinor: 500n, reason: "Split refund" }, fixture);
    const [refunded, siblingAfter] = await Promise.all([prisma.invoice.findUniqueOrThrow({ where: { id: split.invoices[0]!.id } }), prisma.invoice.findUniqueOrThrow({ where: { id: split.invoices[1]!.id } })]);
    expect(refunded.refundedMinor).toBe(500n); expect(siblingAfter.refundedMinor).toBe(siblingBefore.refundedMinor); expect(siblingAfter.status).toBe(siblingBefore.status);
  });

  it("retries one equal-split sync operation without duplicate siblings and preserves rationals", async () => {
    const { orderId } = await orderWithCustomItem(1, "30.00"); const orderItem = await prisma.orderItem.findFirstOrThrow({ where: { orderId } }); const operationId = randomUUID(); const splitGroupId = randomUUID();
    const payload = { orderId, expectedVersion: 2, splitGroupId, splitCount: 3, invoices: Array.from({ length: 3 }, () => ({ id: randomUUID(), allocations: [{ orderItemId: orderItem.id, quantityNumerator: "1", quantityDenominator: "3" }] })) }; const dependencies: string[] = []; const requestHash = hashOperationRequest({ operationType: "FINALIZE_EQUAL_SPLIT", payload, dependencies });
    const operation = { operationId, localSequence: 950_000n + BigInt(Math.floor(Math.random() * 10_000)), requestHash, operationType: "FINALIZE_EQUAL_SPLIT", payload, dependencies };
    const first = await pushOperations(fixture.actorId, fixture.deviceId, [operation]); const second = await pushOperations(fixture.actorId, fixture.deviceId, [operation]);
    expect(second).toEqual(first); expect(await prisma.invoice.count({ where: { splitGroupId } })).toBe(3);
    const rows = await prisma.invoiceAllocationLine.findMany({ where: { invoice: { splitGroupId } } }); expect(rows).toHaveLength(3); expect(rows.every((row) => row.quantityNumerator === 1n && row.quantityDenominator === 3n)).toBe(true);
  });

  it("syncs a split sibling payment with distinct invoice and payment identifiers", async () => {
    const { orderId } = await orderWithCustomItem(1, "30.00"); const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount: 2 }, fixture); const operationId = randomUUID(); const paymentId = randomUUID(); const payload = { invoiceId: split.invoices[0]!.id, id: paymentId, method: "CASH", amountMinor: "1500", tenderedMinor: "1500" }; const dependencies: string[] = []; const requestHash = hashOperationRequest({ operationType: "CREATE_PAYMENT", payload, dependencies });
    await pushOperations(fixture.actorId, fixture.deviceId, [{ operationId, localSequence: 980_000n + BigInt(Math.floor(Math.random() * 10_000)), requestHash, operationType: "CREATE_PAYMENT", payload, dependencies }]);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }); expect(payment.invoiceId).toBe(split.invoices[0]!.id); expect(payment.amountMinor).toBe(1500n);
  });

  it("enforces split metadata and rational allocation checks in PostgreSQL", async () => {
    await expect(prisma.invoice.create({ data: { invoiceNumber: `INVALID-${randomUUID()}`, businessDate: new Date("2026-08-24T00:00:00Z"), subtotalMinor: 0n, totalMinor: 0n, cashierId: fixture.actorId, cashierNameSnapshot: "POS Command Test", cashierRoleSnapshot: "SUPER_ADMIN", deviceId: fixture.deviceId, splitGroupId: randomUUID() } })).rejects.toBeDefined();
    const { orderId } = await orderWithCustomItem(1, "30.00"); const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount: 2 }, fixture); const extra = await prisma.orderItem.create({ data: { orderId, itemNameSnapshot: "Invalid allocation", unitPriceMinor: 1n, quantity: 1, lineTotalMinor: 1n } });
    await expect(prisma.invoiceAllocationLine.create({ data: { invoiceId: split.invoices[0]!.id, orderItemId: extra.id, itemNameSnapshot: extra.itemNameSnapshot, unitPriceMinor: 1n, quantityNumerator: 0n, quantityDenominator: 2n, subtotalMinor: 0n, totalMinor: 0n } })).rejects.toBeDefined();
  });

  it("keeps rational allocation snapshots append-only", async () => {
    const { orderId } = await orderWithCustomItem(1, "30.00"); const split = await finalizeEqualSplit({ orderId, expectedVersion: 2, splitCount: 2 }, fixture); const line = split.invoices[0]!.allocationLines[0]!;
    await expect(prisma.invoiceAllocationLine.update({ where: { id: line.id }, data: { quantityNumerator: 2n } })).rejects.toBeDefined();
    await expect(prisma.invoiceAllocationLine.delete({ where: { id: line.id } })).rejects.toBeDefined();
  });

  it("transfers an order and merges another order without losing table ownership or items", async () => {
    const first = await orderWithItem();
    const second = await orderWithItem();
    const destination = await prisma.diningTable.create({ data: { code: `D-${randomUUID()}` } });

    await transferOrder(first.orderId, { expectedVersion: 2, destinationTableId: destination.id }, fixture);
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: first.table.id } })).status).toBe("AVAILABLE");
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id: destination.id } })).status).toBe("OCCUPIED");

    await mergeOrders(first.orderId, { expectedVersion: 3, sourceOrderIds: [second.orderId] }, fixture);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: second.orderId } })).status).toBe("MERGED");
    expect(await prisma.orderItem.count({ where: { orderId: first.orderId } })).toBe(2);
    const activeTables = await prisma.orderTableAssignment.findMany({ where: { orderId: first.orderId, releasedAt: null } });
    expect(new Set(activeTables.map((row) => row.tableId))).toEqual(new Set([destination.id, second.table.id]));
  });

  it("persists a privileged discount and voids only an unpaid invoice", async () => {
    const { orderId } = await orderWithItem();
    const discount = await applyOrderDiscount(orderId, { expectedVersion: 2, type: "FIXED", fixedAmountMinor: 500n, reason: "RC discount" }, fixture);
    expect(discount.calculatedAmountMinor).toBe(500n);
    const invoice = await finalizeInvoice({ orderId, expectedVersion: 3 }, fixture);
    expect(invoice.totalMinor).toBe(4500n);
    await voidInvoice(invoice.id, { reason: "RC void" }, fixture);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("VOIDED");
  });

  it("keeps Visa out of drawer cash and reverses only the cash part of a full split-payment refund", async () => {
    const visaOrder = await orderWithItem();
    const visaInvoice = await finalizeInvoice({ orderId: visaOrder.orderId, expectedVersion: 2, payments: [{ method: "VISA", amountMinor: 5000n }] }, fixture);
    expect(visaInvoice.status).toBe("PAID");

    const shiftBefore = await prisma.cashierShift.findFirstOrThrow({ where: { userId: fixture.actorId, deviceId: fixture.deviceId, status: "OPEN" } });
    const mixedOrder = await orderWithItem();
    const mixedInvoice = await finalizeInvoice({ orderId: mixedOrder.orderId, expectedVersion: 2, payments: [
      { method: "CASH", amountMinor: 2000n, tenderedMinor: 2500n },
      { method: "VISA", amountMinor: 3000n },
    ] }, fixture);
    const shiftAfterSale = await prisma.cashierShift.findFirstOrThrow({ where: { id: shiftBefore.id } });
    expect(shiftAfterSale.expectedCashMinor - shiftBefore.expectedCashMinor).toBe(2000n);

    await refundInvoice(mixedInvoice.id, { amountMinor: 5000n, reason: "RC full refund" }, fixture);
    const [refunded, shiftAfterRefund] = await Promise.all([
      prisma.invoice.findUniqueOrThrow({ where: { id: mixedInvoice.id } }),
      prisma.cashierShift.findFirstOrThrow({ where: { id: shiftBefore.id } }),
    ]);
    expect(refunded.status).toBe("REFUNDED");
    expect(shiftAfterRefund.expectedCashMinor).toBe(shiftBefore.expectedCashMinor);
  });

  it("creates, seats, and cancels a table reservation with optimistic versions", async () => {
    const table = await prisma.diningTable.create({ data: { code: `R-${randomUUID()}` } });
    const startsAt = new Date("2026-09-01T15:00:00.000Z");
    const reservation = await createReservation({ customerName: "RC guest", phone: "0500000000", guestCount: 2, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000), tableIds: [table.id] }, fixture);
    const seated = await updateReservation(reservation.id, 1, { status: "SEATED" }, fixture);
    expect(seated.status).toBe("SEATED");
    const cancelled = await updateReservation(reservation.id, 2, { status: "CANCELLED" }, fixture);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("closes the RC cashier shift with an exact zero drawer difference", async () => {
    const shift = await prisma.cashierShift.findFirstOrThrow({ where: { userId: fixture.actorId, deviceId: fixture.deviceId, status: "OPEN" } });
    const closed = await closeShift(shift.id, { actualClosingCashMinor: shift.expectedCashMinor }, fixture);
    expect(closed.status).toBe("CLOSED");
    expect(closed.differenceMinor).toBe(0n);
  });
});

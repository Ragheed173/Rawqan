import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";

const BUSINESS_DATE = new Date("2026-08-23T00:00:00.000Z");
const runId = crypto.randomUUID();
const unique = (prefix: string) => `${prefix}-${runId}-${crypto.randomUUID()}`;

let admin: { id: string; name: string; role: string };
let device: { id: string };
let category: { id: string };
let menuItem: { id: string };
let modifierGroup: { id: string };
let modifierOption: { id: string };

async function expectDatabaseRejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeDefined();
    return error;
  }
  throw new Error("Expected PostgreSQL to reject the operation");
}

async function expectTriggerRejection(
  promise: Promise<unknown>,
  message: "append-only" | "physical deletion",
) {
  const error = await expectDatabaseRejection(promise);
  expect(String(error)).toContain(message);
}

async function createAdmin() {
  return prisma.admin.create({
    data: {
      email: `${unique("admin")}@example.test`,
      passwordHash: "phase25-test-hash",
      name: "Phase 2.5 Admin",
      role: "SUPER_ADMIN",
    },
  });
}

async function createDevice() {
  return prisma.posDevice.create({
    data: { code: unique("P"), name: "Phase 2.5 POS" },
  });
}

async function createTable(
  data: Partial<Prisma.DiningTableUncheckedCreateInput> = {},
) {
  return prisma.diningTable.create({
    data: { code: unique("T"), ...data },
  });
}

async function createOrder(
  data: Partial<Prisma.OrderUncheckedCreateInput> = {},
) {
  return prisma.order.create({
    data: {
      businessDate: BUSINESS_DATE,
      openedById: admin.id,
      openedByNameSnapshot: admin.name,
      openedByRoleSnapshot: admin.role,
      deviceId: device.id,
      ...data,
    },
  });
}

async function createInvoice(
  data: Partial<Prisma.InvoiceUncheckedCreateInput> = {},
) {
  return prisma.invoice.create({
    data: {
      invoiceNumber: unique("RWQ-P01-2026"),
      businessDate: BUSINESS_DATE,
      subtotalMinor: 1000n,
      discountMinor: 0n,
      totalMinor: 1000n,
      refundedMinor: 0n,
      cashierId: admin.id,
      cashierNameSnapshot: admin.name,
      cashierRoleSnapshot: admin.role,
      deviceId: device.id,
      ...data,
    },
  });
}

async function createFinancialFixture() {
  const order = await createOrder();
  const table = await createTable();
  const assignment = await prisma.orderTableAssignment.create({
    data: {
      orderId: order.id,
      tableId: table.id,
      assignedById: admin.id,
      assignedByNameSnapshot: admin.name,
      assignedByRoleSnapshot: admin.role,
      isPrimary: true,
    },
  });
  const orderItem = await prisma.orderItem.create({
    data: {
      orderId: order.id,
      menuItemId: menuItem.id,
      itemNameSnapshot: "Snapshot Item",
      unitPriceMinor: 1000n,
      quantity: 1,
      lineTotalMinor: 1000n,
    },
  });
  const orderDiscount = await prisma.orderDiscount.create({
    data: {
      orderId: order.id,
      type: "FIXED",
      fixedAmountMinor: 100n,
      calculatedAmountMinor: 100n,
      reason: "Phase 2.5 order discount",
      actorId: admin.id,
      actorNameSnapshot: admin.name,
      actorRoleSnapshot: admin.role,
    },
  });
  const invoice = await createInvoice();
  const invoiceOrder = await prisma.invoiceOrder.create({
    data: { invoiceId: invoice.id, orderId: order.id },
  });
  const tableSnapshot = await prisma.invoiceTableSnapshot.create({
    data: {
      invoiceId: invoice.id,
      tableId: table.id,
      tableCodeSnapshot: table.code,
    },
  });
  const invoiceLine = await prisma.invoiceLine.create({
    data: {
      invoiceId: invoice.id,
      orderItemId: orderItem.id,
      menuItemId: menuItem.id,
      itemNameSnapshot: "Snapshot Item",
      unitPriceMinor: 1000n,
      quantity: 1,
      subtotalMinor: 1000n,
      discountMinor: 0n,
      totalMinor: 1000n,
    },
  });
  const lineModifier = await prisma.invoiceLineModifier.create({
    data: {
      invoiceLineId: invoiceLine.id,
      modifierOptionId: modifierOption.id,
      groupNameSnapshot: "Size",
      optionNameSnapshot: "Large",
      priceTypeSnapshot: "DELTA",
      unitPriceMinor: 0n,
      quantity: 1,
      totalMinor: 0n,
    },
  });
  const invoiceDiscount = await prisma.invoiceDiscount.create({
    data: {
      invoiceId: invoice.id,
      type: "FIXED",
      fixedAmountMinor: 100n,
      calculatedAmountMinor: 100n,
      reason: "Phase 2.5 invoice discount",
      actorId: admin.id,
      actorNameSnapshot: admin.name,
      actorRoleSnapshot: admin.role,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      method: "CASH",
      amountMinor: 1000n,
      tenderedMinor: 1200n,
      changeMinor: 200n,
      actorId: admin.id,
      actorNameSnapshot: admin.name,
      actorRoleSnapshot: admin.role,
      deviceId: device.id,
    },
  });
  const invoiceVoid = await prisma.invoiceVoid.create({
    data: {
      invoiceId: invoice.id,
      reason: "Phase 2.5 void audit",
      actorId: admin.id,
      actorNameSnapshot: admin.name,
      actorRoleSnapshot: admin.role,
      deviceId: device.id,
    },
  });
  const refund = await prisma.refund.create({
    data: {
      invoiceId: invoice.id,
      amountMinor: 100n,
      reason: "Phase 2.5 partial refund",
      actorId: admin.id,
      actorNameSnapshot: admin.name,
      actorRoleSnapshot: admin.role,
      deviceId: device.id,
    },
  });
  const refundLine = await prisma.refundLine.create({
    data: {
      refundId: refund.id,
      invoiceLineId: invoiceLine.id,
      quantity: 1,
      amountMinor: 100n,
    },
  });
  const refundPayment = await prisma.refundPayment.create({
    data: { refundId: refund.id, paymentId: payment.id, amountMinor: 100n },
  });
  const printEvent = await prisma.receiptPrintEvent.create({
    data: {
      invoiceId: invoice.id,
      deviceId: device.id,
      actorId: admin.id,
      actorNameSnapshot: admin.name,
      actorRoleSnapshot: admin.role,
      type: "INITIAL",
      paperWidthMm: 80,
    },
  });
  return {
    order,
    table,
    assignment,
    orderItem,
    orderDiscount,
    invoice,
    invoiceOrder,
    tableSnapshot,
    invoiceLine,
    lineModifier,
    invoiceDiscount,
    payment,
    invoiceVoid,
    refund,
    refundLine,
    refundPayment,
    printEvent,
  };
}

beforeAll(async () => {
  const createdAdmin = await createAdmin();
  admin = {
    id: createdAdmin.id,
    name: createdAdmin.name,
    role: createdAdmin.role,
  };
  device = await createDevice();
  category = await prisma.category.create({
    data: { slug: unique("category"), name: "Phase 2.5 Category" },
  });
  menuItem = await prisma.menuItem.create({
    data: {
      categoryId: category.id,
      slug: unique("item"),
      name: "Phase 2.5 Item",
      price: "10.00",
    },
  });
  modifierGroup = await prisma.modifierGroup.create({
    data: { type: "VARIANT", name: "Size", minSelections: 1, isRequired: true },
  });
  modifierOption = await prisma.modifierOption.create({
    data: { groupId: modifierGroup.id, name: "Large", price: "0.00" },
  });
});

afterAll(async () => prisma.$disconnect());

describe("PostgreSQL table and order constraints", () => {
  it("rejects duplicate table codes", async () => {
    const code = unique("DUP-TABLE");
    await createTable({ code });
    const error = await expectDatabaseRejection(createTable({ code }));
    expect(error).toMatchObject({ code: "P2002" });
  });

  it("enforces disabled table state consistency", async () => {
    await expectDatabaseRejection(
      createTable({ status: "DISABLED", isActive: true }),
    );
    const disabled = await createTable({ status: "DISABLED", isActive: false });
    expect(disabled.isActive).toBe(false);
  });

  it("rejects duplicate active assignments for one table", async () => {
    const table = await createTable();
    const first = await createOrder();
    const second = await createOrder();
    const assignment = {
      tableId: table.id,
      assignedById: admin.id,
      assignedByNameSnapshot: admin.name,
      assignedByRoleSnapshot: admin.role,
    };
    await prisma.orderTableAssignment.create({
      data: { ...assignment, orderId: first.id },
    });
    await expectDatabaseRejection(
      prisma.orderTableAssignment.create({
        data: { ...assignment, orderId: second.id },
      }),
    );
  });

  it("rejects non-positive optimistic versions", async () => {
    await expectDatabaseRejection(createOrder({ version: 0 }));
  });

  it("rejects non-positive order item quantities", async () => {
    const order = await createOrder();
    await expectDatabaseRejection(
      prisma.orderItem.create({
        data: {
          orderId: order.id,
          itemNameSnapshot: "Invalid quantity",
          unitPriceMinor: 100n,
          quantity: 0,
          lineTotalMinor: 0n,
        },
      }),
    );
  });

  it("enforces assignment release snapshots and timing", async () => {
    const order = await createOrder();
    const table = await createTable();
    await expectDatabaseRejection(
      prisma.orderTableAssignment.create({
        data: {
          orderId: order.id,
          tableId: table.id,
          assignedByNameSnapshot: admin.name,
          assignedByRoleSnapshot: admin.role,
          releasedAt: new Date(),
        },
      }),
    );
  });

  it("rejects invalid closed and merged order states", async () => {
    await expectDatabaseRejection(createOrder({ status: "CLOSED" }));
    await expectDatabaseRejection(
      createOrder({ status: "MERGED", closedAt: new Date() }),
    );
  });

  it("rejects physical order deletion", async () => {
    const order = await createOrder();
    await expectTriggerRejection(
      prisma.order.delete({ where: { id: order.id } }),
      "physical deletion",
    );
  });
});

describe("PostgreSQL shift constraints", () => {
  it("allows only one open shift per cashier/device", async () => {
    const shiftDevice = await createDevice();
    const data = {
      userId: admin.id,
      userNameSnapshot: admin.name,
      userRoleSnapshot: admin.role,
      deviceId: shiftDevice.id,
      businessDate: BUSINESS_DATE,
      openingCashMinor: 1000n,
    };
    await prisma.cashierShift.create({ data });
    await expectDatabaseRejection(prisma.cashierShift.create({ data }));
  });

  it("accepts complete closed-shift fields", async () => {
    const shiftDevice = await createDevice();
    const openedAt = new Date("2026-08-23T08:00:00.000Z");
    const shift = await prisma.cashierShift.create({
      data: {
        userId: admin.id,
        userNameSnapshot: admin.name,
        userRoleSnapshot: admin.role,
        deviceId: shiftDevice.id,
        status: "CLOSED",
        businessDate: BUSINESS_DATE,
        openingCashMinor: 1000n,
        expectedCashMinor: 1500n,
        actualClosingCashMinor: 1490n,
        differenceMinor: -10n,
        openedAt,
        closedAt: new Date("2026-08-23T16:00:00.000Z"),
      },
    });
    expect(shift.status).toBe("CLOSED");
  });

  it("rejects incomplete closed state and negative cash", async () => {
    const shiftDevice = await createDevice();
    await expectDatabaseRejection(
      prisma.cashierShift.create({
        data: {
          userId: admin.id,
          userNameSnapshot: admin.name,
          userRoleSnapshot: admin.role,
          deviceId: shiftDevice.id,
          status: "CLOSED",
          businessDate: BUSINESS_DATE,
          openingCashMinor: 1000n,
        },
      }),
    );
    await expectDatabaseRejection(
      prisma.cashierShift.create({
        data: {
          userId: admin.id,
          userNameSnapshot: admin.name,
          userRoleSnapshot: admin.role,
          deviceId: shiftDevice.id,
          businessDate: BUSINESS_DATE,
          openingCashMinor: -1n,
        },
      }),
    );
  });
});

describe("PostgreSQL invoice and payment constraints", () => {
  it("accepts valid invoice arithmetic", async () => {
    const invoice = await createInvoice({
      subtotalMinor: 1500n,
      discountMinor: 200n,
      totalMinor: 1300n,
      refundedMinor: 300n,
    });
    expect(invoice.totalMinor).toBe(1300n);
  });

  it.each([
    { subtotalMinor: 1000n, discountMinor: 100n, totalMinor: 950n },
    { subtotalMinor: 1000n, discountMinor: 1100n, totalMinor: -100n },
    {
      subtotalMinor: 1000n,
      discountMinor: 0n,
      totalMinor: 1000n,
      refundedMinor: 1001n,
    },
  ])("rejects invalid invoice arithmetic %#", async (values) => {
    await expectDatabaseRejection(createInvoice(values));
  });

  it("supports multiple payments on one invoice", async () => {
    const invoice = await createInvoice();
    await prisma.payment.createMany({
      data: [
        {
          invoiceId: invoice.id,
          method: "CASH",
          amountMinor: 600n,
          tenderedMinor: 600n,
          changeMinor: 0n,
          actorId: admin.id,
          actorNameSnapshot: admin.name,
          actorRoleSnapshot: admin.role,
          deviceId: device.id,
        },
        {
          invoiceId: invoice.id,
          method: "VISA",
          amountMinor: 400n,
          actorId: admin.id,
          actorNameSnapshot: admin.name,
          actorRoleSnapshot: admin.role,
          deviceId: device.id,
        },
      ],
    });
    expect(
      await prisma.payment.count({ where: { invoiceId: invoice.id } }),
    ).toBe(2);
  });

  it("accepts valid cash tender/change", async () => {
    const invoice = await createInvoice();
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        method: "CASH",
        amountMinor: 800n,
        tenderedMinor: 1000n,
        changeMinor: 200n,
        actorNameSnapshot: admin.name,
        actorRoleSnapshot: admin.role,
        deviceId: device.id,
      },
    });
    expect(payment.changeMinor).toBe(200n);
  });

  it("rejects invalid cash arithmetic and VISA tender fields", async () => {
    const invoice = await createInvoice();
    await expectDatabaseRejection(
      prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          method: "CASH",
          amountMinor: 800n,
          tenderedMinor: 900n,
          changeMinor: 50n,
          actorNameSnapshot: admin.name,
          actorRoleSnapshot: admin.role,
          deviceId: device.id,
        },
      }),
    );
    await expectDatabaseRejection(
      prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          method: "VISA",
          amountMinor: 800n,
          tenderedMinor: 800n,
          changeMinor: 0n,
          actorNameSnapshot: admin.name,
          actorRoleSnapshot: admin.role,
          deviceId: device.id,
        },
      }),
    );
  });
});

describe("PostgreSQL refund, reservation, and sync constraints", () => {
  it("accepts valid partial refund structures", async () => {
    const fixture = await createFinancialFixture();
    expect(fixture.refund.amountMinor).toBe(100n);
    expect(fixture.refundLine.quantity).toBe(1);
    expect(fixture.refundPayment.amountMinor).toBe(100n);
  });

  it("rejects duplicate refund line and payment allocations", async () => {
    const fixture = await createFinancialFixture();
    const lineError = await expectDatabaseRejection(
      prisma.refundLine.create({
        data: {
          refundId: fixture.refund.id,
          invoiceLineId: fixture.invoiceLine.id,
          quantity: 1,
          amountMinor: 1n,
        },
      }),
    );
    expect(lineError).toMatchObject({ code: "P2002" });
    const paymentError = await expectDatabaseRejection(
      prisma.refundPayment.create({
        data: {
          refundId: fixture.refund.id,
          paymentId: fixture.payment.id,
          amountMinor: 1n,
        },
      }),
    );
    expect(paymentError).toMatchObject({ code: "P2002" });
  });

  it("rejects zero or negative refund values", async () => {
    const invoice = await createInvoice();
    await expectDatabaseRejection(
      prisma.refund.create({
        data: {
          invoiceId: invoice.id,
          amountMinor: 0n,
          reason: "Invalid",
          actorNameSnapshot: admin.name,
          actorRoleSnapshot: admin.role,
          deviceId: device.id,
        },
      }),
    );
    const fixture = await createFinancialFixture();
    await expectDatabaseRejection(
      prisma.refundLine.create({
        data: {
          refundId: fixture.refund.id,
          invoiceLineId: fixture.invoiceLine.id,
          quantity: 0,
          amountMinor: -1n,
        },
      }),
    );
    const anotherPayment = await prisma.payment.create({
      data: {
        invoiceId: fixture.invoice.id,
        method: "VISA",
        amountMinor: 1n,
        actorNameSnapshot: admin.name,
        actorRoleSnapshot: admin.role,
        deviceId: device.id,
      },
    });
    await expectDatabaseRejection(
      prisma.refundPayment.create({
        data: {
          refundId: fixture.refund.id,
          paymentId: anotherPayment.id,
          amountMinor: 0n,
        },
      }),
    );
  });

  it("accepts valid reservations and rejects invalid ranges", async () => {
    const valid = await prisma.reservation.create({
      data: {
        customerName: "Phase 2.5 Guest",
        phone: unique("phone"),
        guestCount: 2,
        startsAt: new Date("2026-08-23T18:00:00.000Z"),
        endsAt: new Date("2026-08-23T20:00:00.000Z"),
        createdByNameSnapshot: admin.name,
        createdByRoleSnapshot: admin.role,
      },
    });
    expect(valid.guestCount).toBe(2);
    await expectDatabaseRejection(
      prisma.reservation.create({
        data: {
          customerName: "Invalid range",
          phone: unique("phone"),
          guestCount: 2,
          startsAt: new Date("2026-08-23T20:00:00.000Z"),
          endsAt: new Date("2026-08-23T18:00:00.000Z"),
          createdByNameSnapshot: admin.name,
          createdByRoleSnapshot: admin.role,
        },
      }),
    );
  });

  it("enforces sync operation and device-sequence uniqueness", async () => {
    const operationId = crypto.randomUUID();
    await prisma.syncOperation.create({
      data: {
        operationId,
        deviceId: device.id,
        localSequence: 10_000n + BigInt(Math.floor(Math.random() * 10_000)),
        requestHash: unique("hash"),
        operationType: "PHASE25_TEST",
      },
    });
    const idError = await expectDatabaseRejection(
      prisma.syncOperation.create({
        data: {
          operationId,
          deviceId: device.id,
          localSequence: 30_000n + BigInt(Math.floor(Math.random() * 10_000)),
          requestHash: unique("different-hash"),
          operationType: "PHASE25_TEST",
        },
      }),
    );
    expect(idError).toMatchObject({ code: "P2002" });

    const sequence = 50_000n + BigInt(Math.floor(Math.random() * 10_000));
    await prisma.syncOperation.create({
      data: {
        operationId: crypto.randomUUID(),
        deviceId: device.id,
        localSequence: sequence,
        requestHash: unique("hash"),
        operationType: "PHASE25_TEST",
      },
    });
    const sequenceError = await expectDatabaseRejection(
      prisma.syncOperation.create({
        data: {
          operationId: crypto.randomUUID(),
          deviceId: device.id,
          localSequence: sequence,
          requestHash: unique("hash"),
          operationType: "PHASE25_TEST",
        },
      }),
    );
    expect(sequenceError).toMatchObject({ code: "P2002" });
  });

  it("enforces sync processing timestamps for terminal states", async () => {
    await prisma.syncOperation.create({
      data: {
        operationId: crypto.randomUUID(),
        deviceId: device.id,
        localSequence: 70_000n + BigInt(Math.floor(Math.random() * 10_000)),
        requestHash: unique("hash"),
        operationType: "PHASE25_TEST",
        status: "SUCCEEDED",
        processedAt: new Date(),
      },
    });
    await expectDatabaseRejection(
      prisma.syncOperation.create({
        data: {
          operationId: crypto.randomUUID(),
          deviceId: device.id,
          localSequence: 90_000n + BigInt(Math.floor(Math.random() * 10_000)),
          requestHash: unique("hash"),
          operationType: "PHASE25_TEST",
          status: "FAILED",
        },
      }),
    );
    await expectDatabaseRejection(
      prisma.syncOperation.create({
        data: {
          operationId: crypto.randomUUID(),
          deviceId: device.id,
          localSequence: 110_000n + BigInt(Math.floor(Math.random() * 10_000)),
          requestHash: unique("hash"),
          operationType: "PHASE25_TEST",
          status: "PENDING",
          processedAt: new Date(),
        },
      }),
    );
  });
});

describe("PostgreSQL financial immutability triggers", () => {
  let fixture: Awaited<ReturnType<typeof createFinancialFixture>>;

  beforeAll(async () => {
    fixture = await createFinancialFixture();
  });

  it("allows aggregate state changes but rejects invoice/payment/order deletion", async () => {
    const paidAt = new Date();
    const invoice = await prisma.invoice.update({
      where: { id: fixture.invoice.id },
      data: { status: "PAID", paidAt },
    });
    expect(invoice.status).toBe("PAID");
    const payment = await prisma.payment.update({
      where: { id: fixture.payment.id },
      data: { status: "REFUNDED" },
    });
    expect(payment.status).toBe("REFUNDED");
    await expectTriggerRejection(
      prisma.invoice.delete({ where: { id: fixture.invoice.id } }),
      "physical deletion",
    );
    await expectTriggerRejection(
      prisma.payment.delete({ where: { id: fixture.payment.id } }),
      "physical deletion",
    );
    await expectTriggerRejection(
      prisma.order.delete({ where: { id: fixture.order.id } }),
      "physical deletion",
    );
  });

  it("rejects updates and deletes of invoice snapshot rows", async () => {
    await expectTriggerRejection(
      prisma.invoiceOrder.update({
        where: { id: fixture.invoiceOrder.id },
        data: { createdAt: new Date() },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceOrder.delete({ where: { id: fixture.invoiceOrder.id } }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceTableSnapshot.update({
        where: { id: fixture.tableSnapshot.id },
        data: { tableCodeSnapshot: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceTableSnapshot.delete({
        where: { id: fixture.tableSnapshot.id },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceLine.update({
        where: { id: fixture.invoiceLine.id },
        data: { itemNameSnapshot: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceLine.delete({ where: { id: fixture.invoiceLine.id } }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceLineModifier.update({
        where: { id: fixture.lineModifier.id },
        data: { optionNameSnapshot: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceLineModifier.delete({
        where: { id: fixture.lineModifier.id },
      }),
      "append-only",
    );
  });

  it("rejects updates and deletes of discount/void audit rows", async () => {
    await expectTriggerRejection(
      prisma.orderDiscount.update({
        where: { id: fixture.orderDiscount.id },
        data: { reason: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.orderDiscount.delete({ where: { id: fixture.orderDiscount.id } }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceDiscount.update({
        where: { id: fixture.invoiceDiscount.id },
        data: { reason: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceDiscount.delete({
        where: { id: fixture.invoiceDiscount.id },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceVoid.update({
        where: { id: fixture.invoiceVoid.id },
        data: { reason: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.invoiceVoid.delete({ where: { id: fixture.invoiceVoid.id } }),
      "append-only",
    );
  });

  it("rejects updates and deletes of refund facts and allocations", async () => {
    await expectTriggerRejection(
      prisma.refund.update({
        where: { id: fixture.refund.id },
        data: { reason: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.refund.delete({ where: { id: fixture.refund.id } }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.refundLine.update({
        where: { id: fixture.refundLine.id },
        data: { amountMinor: 1n },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.refundLine.delete({ where: { id: fixture.refundLine.id } }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.refundPayment.update({
        where: { id: fixture.refundPayment.id },
        data: { amountMinor: 1n },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.refundPayment.delete({
        where: { id: fixture.refundPayment.id },
      }),
      "append-only",
    );
  });

  it("rejects receipt-print audit changes", async () => {
    await expectTriggerRejection(
      prisma.receiptPrintEvent.update({
        where: { id: fixture.printEvent.id },
        data: { profileName: "changed" },
      }),
      "append-only",
    );
    await expectTriggerRejection(
      prisma.receiptPrintEvent.delete({
        where: { id: fixture.printEvent.id },
      }),
      "append-only",
    );
  });

  it("rejects physical cashier-shift deletion", async () => {
    const shiftDevice = await createDevice();
    const shift = await prisma.cashierShift.create({
      data: {
        userId: admin.id,
        userNameSnapshot: admin.name,
        userRoleSnapshot: admin.role,
        deviceId: shiftDevice.id,
        businessDate: BUSINESS_DATE,
        openingCashMinor: 0n,
      },
    });
    await expectTriggerRejection(
      prisma.cashierShift.delete({ where: { id: shift.id } }),
      "physical deletion",
    );
  });
});

describe("PostgreSQL delete policies and compatibility exceptions", () => {
  it("SET NULL preserves snapshots when a legacy Admin is deleted", async () => {
    const mutableAdmin = await createAdmin();
    const invoice = await createInvoice({
      cashierId: mutableAdmin.id,
      cashierNameSnapshot: mutableAdmin.name,
      cashierRoleSnapshot: mutableAdmin.role,
    });
    const discount = await prisma.invoiceDiscount.create({
      data: {
        invoiceId: invoice.id,
        type: "FIXED",
        fixedAmountMinor: 1n,
        calculatedAmountMinor: 1n,
        reason: "Compatibility test",
        actorId: mutableAdmin.id,
        actorNameSnapshot: mutableAdmin.name,
        actorRoleSnapshot: mutableAdmin.role,
      },
    });

    await prisma.admin.delete({ where: { id: mutableAdmin.id } });
    const preservedInvoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    const preservedDiscount = await prisma.invoiceDiscount.findUniqueOrThrow({
      where: { id: discount.id },
    });
    expect(preservedInvoice.cashierId).toBeNull();
    expect(preservedInvoice.cashierNameSnapshot).toBe(mutableAdmin.name);
    expect(preservedDiscount.actorId).toBeNull();
    expect(preservedDiscount.actorNameSnapshot).toBe(mutableAdmin.name);
  });

  it("deactivation keeps the Admin reference and immutable snapshot", async () => {
    const mutableAdmin = await createAdmin();
    const invoice = await createInvoice({
      cashierId: mutableAdmin.id,
      cashierNameSnapshot: mutableAdmin.name,
      cashierRoleSnapshot: mutableAdmin.role,
    });
    await prisma.admin.update({
      where: { id: mutableAdmin.id },
      data: { isActive: false },
    });
    const preserved = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(preserved.cashierId).toBe(mutableAdmin.id);
    expect(preserved.cashierNameSnapshot).toBe(mutableAdmin.name);
  });

  it("SET NULL preserves invoice snapshots when a legacy MenuItem is deleted", async () => {
    const localCategory = await prisma.category.create({
      data: { slug: unique("category"), name: "Compatibility Category" },
    });
    const mutableItem = await prisma.menuItem.create({
      data: {
        categoryId: localCategory.id,
        slug: unique("item"),
        name: "Mutable Menu Item",
        price: "12.00",
      },
    });
    const invoice = await createInvoice();
    const line = await prisma.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        menuItemId: mutableItem.id,
        itemNameSnapshot: mutableItem.name,
        unitPriceMinor: 1200n,
        quantity: 1,
        subtotalMinor: 1200n,
        totalMinor: 1200n,
      },
    });
    await prisma.menuItem.delete({ where: { id: mutableItem.id } });
    const preserved = await prisma.invoiceLine.findUniqueOrThrow({
      where: { id: line.id },
    });
    expect(preserved.menuItemId).toBeNull();
    expect(preserved.itemNameSnapshot).toBe("Mutable Menu Item");
  });

  it("SET NULL preserves modifier snapshots when an option is deleted", async () => {
    const group = await prisma.modifierGroup.create({
      data: { type: "ADD_ON", name: "Compatibility Group" },
    });
    const option = await prisma.modifierOption.create({
      data: { groupId: group.id, name: "Compatibility Option", price: "1.00" },
    });
    const invoice = await createInvoice();
    const line = await prisma.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        itemNameSnapshot: "Snapshot Item",
        unitPriceMinor: 1000n,
        quantity: 1,
        subtotalMinor: 1000n,
        totalMinor: 1000n,
      },
    });
    const lineModifier = await prisma.invoiceLineModifier.create({
      data: {
        invoiceLineId: line.id,
        modifierOptionId: option.id,
        groupNameSnapshot: group.name,
        optionNameSnapshot: option.name,
        priceTypeSnapshot: "DELTA",
        unitPriceMinor: 100n,
        quantity: 1,
        totalMinor: 100n,
      },
    });
    await prisma.modifierOption.delete({ where: { id: option.id } });
    const preserved = await prisma.invoiceLineModifier.findUniqueOrThrow({
      where: { id: lineModifier.id },
    });
    expect(preserved.modifierOptionId).toBeNull();
    expect(preserved.optionNameSnapshot).toBe("Compatibility Option");
  });

  it("RESTRICT protects referenced devices, tables, and reservations", async () => {
    const restrictedDevice = await createDevice();
    await createInvoice({ deviceId: restrictedDevice.id });
    await expectDatabaseRejection(
      prisma.posDevice.delete({ where: { id: restrictedDevice.id } }),
    );

    const restrictedTable = await createTable();
    const reservation = await prisma.reservation.create({
      data: {
        customerName: "Restricted reservation",
        phone: unique("phone"),
        guestCount: 2,
        startsAt: new Date("2026-08-24T18:00:00.000Z"),
        createdByNameSnapshot: admin.name,
        createdByRoleSnapshot: admin.role,
      },
    });
    await prisma.reservationTable.create({
      data: {
        reservationId: reservation.id,
        tableId: restrictedTable.id,
        tableCodeSnapshot: restrictedTable.code,
      },
    });
    await expectDatabaseRejection(
      prisma.diningTable.delete({ where: { id: restrictedTable.id } }),
    );
    await expectDatabaseRejection(
      prisma.reservation.delete({ where: { id: reservation.id } }),
    );
  });

  it("CASCADE is limited to the non-financial menu/modifier join", async () => {
    const localCategory = await prisma.category.create({
      data: { slug: unique("category"), name: "Cascade Category" },
    });
    const item = await prisma.menuItem.create({
      data: {
        categoryId: localCategory.id,
        slug: unique("item"),
        name: "Cascade Item",
        price: "1.00",
      },
    });
    const group = await prisma.modifierGroup.create({
      data: { type: "ADD_ON", name: "Cascade Group" },
    });
    const link = await prisma.menuItemModifierGroup.create({
      data: { menuItemId: item.id, groupId: group.id },
    });
    await prisma.menuItem.delete({ where: { id: item.id } });
    expect(
      await prisma.menuItemModifierGroup.findUnique({ where: { id: link.id } }),
    ).toBeNull();
    expect(await prisma.modifierGroup.count({ where: { id: group.id } })).toBe(
      1,
    );
  });
});

describe("PostgreSQL metadata and index readiness", () => {
  it("runs on a real PostgreSQL 16 database", async () => {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ server_version: string }>
    >("SHOW server_version");
    expect(rows[0]?.server_version).toMatch(/^16\./);
  });

  it("contains indexes for the expected Phase 3 query shapes", async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()",
    );
    const indexes = new Set(rows.map((row) => row.indexname));
    for (const name of [
      "order_table_assignments_one_active_table_key",
      "orders_status_business_date_idx",
      "invoices_status_business_date_idx",
      "payments_invoice_id_paid_at_idx",
      "reservations_status_starts_at_idx",
      "cashier_shifts_one_open_user_device_key",
      "sync_operations_device_id_status_local_sequence_idx",
      "sync_operations_device_id_local_sequence_key",
    ]) {
      expect(indexes.has(name), `missing PostgreSQL index ${name}`).toBe(true);
    }
  });
});

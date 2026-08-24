import { randomUUID } from "node:crypto";
import type { AdminRole, Prisma, ReservationStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { writeActivity } from "../../lib/activityLog.js";
import { businessDateFor } from "../../domain/businessTime.js";
import { decimalToMinorUnits, sumMinorUnits } from "../../domain/money.js";
import { allocateDiscountAcrossLines, allocateLinesToTargets, calculateInvoiceTotals, splitEqual, type DiscountRequest } from "../../domain/pos/billing.js";
import { posAssert } from "../../domain/pos/errors.js";
import { addRational, compareRational, reduceRational, type RationalQuantity } from "../../domain/pos/rational.js";
import { assertReservation, reconcileShift } from "../../domain/pos/operations.js";
import { validatePayments, validateRefund, type PaymentAllocation } from "../../domain/pos/payments.js";
import { priceOrderLine, type ModifierGroupRule, type SelectedModifier } from "../../domain/pos/pricing.js";
import { assertOrderTransition, invoiceStatusForRefund } from "../../domain/pos/stateMachines.js";

export type PosTx = Prisma.TransactionClient;

export interface PosActorContext {
  actorId: string;
  deviceId: string;
  operationId?: string;
  ip?: string;
}

interface ActorSnapshot {
  id: string;
  name: string;
  role: AdminRole;
}

function inTransaction<T>(work: (tx: PosTx) => Promise<T>, tx?: PosTx): Promise<T> {
  return tx ? work(tx) : prisma.$transaction(work);
}

async function loadContext(tx: PosTx, context: PosActorContext) {
  const [actor, device] = await Promise.all([
    tx.admin.findUnique({ where: { id: context.actorId }, select: { id: true, name: true, role: true, isActive: true } }),
    tx.posDevice.findUnique({ where: { id: context.deviceId } }),
  ]);
  posAssert(actor?.isActive, "DEVICE_NOT_AUTHORIZED", "POS user is inactive or missing");
  posAssert(device?.isActive, "DEVICE_NOT_AUTHORIZED", "POS device is inactive or missing");
  return { actor: actor as ActorSnapshot, device };
}

async function getBusinessDate(tx: PosTx, at = new Date()): Promise<Date> {
  const settings = await tx.restaurantSettings.findFirst({
    select: { timezone: true, businessDayCutoff: true },
  });
  const value = businessDateFor(at, {
    timeZone: settings?.timezone ?? "Asia/Hebron",
    businessDayCutoff: settings?.businessDayCutoff ?? "04:00",
  });
  return new Date(`${value}T00:00:00.000Z`);
}

function actorAudit(actor: ActorSnapshot) {
  return {
    adminId: actor.id,
    actorNameSnapshot: actor.name,
    actorRoleSnapshot: actor.role,
  };
}

async function assertOrderVersion(tx: PosTx, orderId: string, expectedVersion: number) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  posAssert(order, "ORDER_NOT_FOUND", "Order not found");
  posAssert(order.version === expectedVersion, "VERSION_CONFLICT", "Order version conflict", {
    expectedVersion,
    actualVersion: order.version,
  });
  return order;
}

export interface ConfigureTableInput {
  id?: string;
  code: string;
  displayName?: string | null;
  capacity?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}

export function createTable(input: ConfigureTableInput, context: PosActorContext) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    posAssert(actor.role === "SUPER_ADMIN", "DISCOUNT_NOT_ALLOWED", "Only the main admin may configure tables");
    const isActive = input.isActive ?? true;
    const table = await tx.diningTable.create({
      data: {
        id: input.id,
        code: input.code.trim().toUpperCase(),
        displayName: input.displayName?.trim() || null,
        capacity: input.capacity,
        sortOrder: input.sortOrder ?? 0,
        isActive,
        status: isActive ? "AVAILABLE" : "DISABLED",
      },
    });
    await writeActivity({ ...actorAudit(actor), action: "CREATE", entityType: "DiningTable", entityId: table.id, deviceId: context.deviceId, operationId: context.operationId, afterData: { code: table.code, isActive } }, tx);
    return table;
  });
}

export function updateTable(tableId: string, input: Omit<ConfigureTableInput, "id" | "code"> & { code?: string }, context: PosActorContext) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    posAssert(actor.role === "SUPER_ADMIN", "DISCOUNT_NOT_ALLOWED", "Only the main admin may configure tables");
    const current = await tx.diningTable.findUnique({ where: { id: tableId } });
    posAssert(current, "TABLE_NOT_FOUND", "Table not found");
    if (input.isActive === false) {
      const active = await tx.orderTableAssignment.findFirst({ where: { tableId, releasedAt: null } });
      posAssert(!active, "TABLE_OCCUPIED", "An occupied table cannot be disabled");
    }
    const table = await tx.diningTable.update({
      where: { id: tableId },
      data: {
        code: input.code?.trim().toUpperCase(),
        displayName: input.displayName === undefined ? undefined : input.displayName?.trim() || null,
        capacity: input.capacity,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        status: input.isActive === false ? "DISABLED" : current.status === "DISABLED" ? "AVAILABLE" : undefined,
      },
    });
    await writeActivity({ ...actorAudit(actor), action: "UPDATE", entityType: "DiningTable", entityId: table.id, deviceId: context.deviceId, operationId: context.operationId, beforeData: { code: current.code, status: current.status }, afterData: { code: table.code, status: table.status } }, tx);
    return table;
  });
}

export interface OpenOrderInput {
  id?: string;
  tableId: string;
  guestCount?: number | null;
  notes?: string | null;
}

export function openOrder(input: OpenOrderInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const table = await tx.diningTable.findUnique({ where: { id: input.tableId } });
    posAssert(table, "TABLE_NOT_FOUND", "Table not found");
    posAssert(table.isActive && table.status !== "DISABLED", "TABLE_DISABLED", "Table is disabled");
    const occupied = await tx.orderTableAssignment.findFirst({ where: { tableId: table.id, releasedAt: null } });
    posAssert(!occupied, "TABLE_OCCUPIED", "Table already has an active order");
    if (input.guestCount !== undefined && input.guestCount !== null) {
      posAssert(Number.isInteger(input.guestCount) && input.guestCount > 0, "INVALID_QUANTITY", "Guest count must be positive");
    }
    const order = await tx.order.create({
      data: {
        id: input.id,
        guestCount: input.guestCount,
        notes: input.notes?.trim() || null,
        businessDate: await getBusinessDate(tx),
        openedById: actor.id,
        openedByNameSnapshot: actor.name,
        openedByRoleSnapshot: actor.role,
        deviceId: context.deviceId,
        tables: { create: { tableId: table.id, assignedById: actor.id, assignedByNameSnapshot: actor.name, assignedByRoleSnapshot: actor.role, isPrimary: true } },
      },
      include: { tables: true },
    });
    await tx.diningTable.update({ where: { id: table.id }, data: { status: "OCCUPIED" } });
    await writeActivity({ ...actorAudit(actor), action: "ORDER_CREATED", entityType: "Order", entityId: order.id, deviceId: context.deviceId, operationId: context.operationId, afterData: { tableId: table.id, guestCount: input.guestCount ?? null } }, tx);
    return order;
  }, existingTx);
}

export function updateOrder(orderId: string, input: { expectedVersion: number; guestCount?: number | null; notes?: string | null }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, orderId, input.expectedVersion);
    posAssert(["OPEN", "BILL_REQUESTED"].includes(order.status), "ORDER_NOT_OPEN", "Order cannot be edited in its current state");
    if (input.guestCount !== undefined && input.guestCount !== null) posAssert(Number.isInteger(input.guestCount) && input.guestCount > 0, "INVALID_QUANTITY", "Guest count must be positive");
    const updated = await tx.order.update({ where: { id: orderId }, data: { guestCount: input.guestCount, notes: input.notes === undefined ? undefined : input.notes?.trim() || null, version: { increment: 1 } } });
    await writeActivity({ ...actorAudit(actor), action: "ORDER_UPDATED", entityType: "Order", entityId: orderId, deviceId: context.deviceId, operationId: context.operationId, beforeData: { guestCount: order.guestCount, notes: order.notes }, afterData: { guestCount: updated.guestCount, notes: updated.notes } }, tx);
    return updated;
  }, existingTx);
}

export interface AddOrderItemInput {
  id?: string;
  expectedVersion: number;
  menuItemId: string;
  quantity: number;
  notes?: string | null;
  modifierOptionIds?: string[];
}

export function addOrderItem(orderId: string, input: AddOrderItemInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, orderId, input.expectedVersion);
    posAssert(order.status === "OPEN", "ORDER_NOT_OPEN", "Only an open order can be edited");
    const item = await tx.menuItem.findUnique({
      where: { id: input.menuItemId },
      include: { modifierGroupLinks: { include: { group: { include: { options: true } } }, orderBy: { sortOrder: "asc" } } },
    });
    posAssert(item && item.isAvailable && !item.isArchived, "INVALID_ORDER_STATE", "Menu item is unavailable");
    const optionIds = input.modifierOptionIds ?? [];
    const groups: ModifierGroupRule[] = item.modifierGroupLinks.map(({ group }) => ({ id: group.id, type: group.type, minSelections: group.minSelections, maxSelections: group.maxSelections }));
    const optionMap = new Map(item.modifierGroupLinks.flatMap(({ group }) => group.options.map((option) => [option.id, { group, option }] as const)));
    const selected: SelectedModifier[] = optionIds.map((id) => {
      const entry = optionMap.get(id);
      posAssert(entry?.group.isActive && entry.option.isActive, "INVALID_MODIFIER_SELECTION", `Modifier option ${id} is unavailable`);
      return {
        id,
        groupId: entry.group.id,
        groupType: entry.group.type,
        priceType: entry.option.priceType,
        priceMinor: decimalToMinorUnits(entry.option.price),
      };
    });
    const now = new Date();
    const promotionalPrice = item.discountPrice && (!item.promoFrom || item.promoFrom <= now) && (!item.promoUntil || item.promoUntil >= now) ? decimalToMinorUnits(item.discountPrice) : null;
    const priced = priceOrderLine({ basePriceMinor: decimalToMinorUnits(item.price), promotionalPriceMinor: promotionalPrice, quantity: input.quantity, groups, modifiers: selected });
    const created = await tx.orderItem.create({
      data: {
        id: input.id,
        orderId,
        menuItemId: item.id,
        itemNameSnapshot: item.name,
        itemNameEnSnapshot: item.nameEn,
        unitPriceMinor: priced.unitPriceMinor,
        quantity: input.quantity,
        lineTotalMinor: priced.lineTotalMinor,
        notes: input.notes?.trim() || null,
        modifiers: {
          create: optionIds.map((id) => {
            const { group, option } = optionMap.get(id)!;
            const unitPriceMinor = decimalToMinorUnits(option.price);
            return {
              id: randomUUID(),
              modifierOptionId: option.id,
              groupNameSnapshot: group.name,
              groupNameEnSnapshot: group.nameEn,
              optionNameSnapshot: option.name,
              optionNameEnSnapshot: option.nameEn,
              priceTypeSnapshot: option.priceType,
              unitPriceMinor,
              quantity: 1,
              lineTotalMinor: unitPriceMinor,
            };
          }),
        },
      },
      include: { modifiers: true },
    });
    await tx.order.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    await writeActivity({ ...actorAudit(actor), action: "ORDER_UPDATED", entityType: "Order", entityId: orderId, deviceId: context.deviceId, operationId: context.operationId, afterData: { orderItemId: created.id, quantity: created.quantity, lineTotalMinor: created.lineTotalMinor.toString() } }, tx);
    return created;
  }, existingTx);
}

export function updateOrderItem(orderId: string, itemId: string, input: { expectedVersion: number; quantity: number; notes?: string | null }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, orderId, input.expectedVersion);
    posAssert(order.status === "OPEN", "ORDER_NOT_OPEN", "Only an open order can be edited");
    posAssert(Number.isInteger(input.quantity) && input.quantity > 0, "INVALID_QUANTITY", "Quantity must be positive");
    const current = await tx.orderItem.findFirst({ where: { id: itemId, orderId } });
    posAssert(current, "ORDER_NOT_FOUND", "Order item not found");
    const updated = await tx.orderItem.update({ where: { id: itemId }, data: { quantity: input.quantity, lineTotalMinor: current.unitPriceMinor * BigInt(input.quantity), notes: input.notes === undefined ? undefined : input.notes?.trim() || null } });
    await tx.order.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    await writeActivity({ ...actorAudit(actor), action: "ORDER_UPDATED", entityType: "Order", entityId: orderId, deviceId: context.deviceId, operationId: context.operationId, beforeData: { orderItemId: itemId, quantity: current.quantity }, afterData: { orderItemId: itemId, quantity: updated.quantity } }, tx);
    return updated;
  }, existingTx);
}

export function removeOrderItem(orderId: string, itemId: string, expectedVersion: number, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, orderId, expectedVersion);
    posAssert(order.status === "OPEN", "ORDER_NOT_OPEN", "Only an open order can be edited");
    const item = await tx.orderItem.findFirst({ where: { id: itemId, orderId }, include: { invoiceLines: { select: { id: true } } } });
    posAssert(item, "ORDER_NOT_FOUND", "Order item not found");
    posAssert(item.invoiceLines.length === 0, "INVALID_ORDER_STATE", "A billed order item cannot be removed");
    await tx.orderItemModifier.deleteMany({ where: { orderItemId: itemId } });
    await tx.orderItem.delete({ where: { id: itemId } });
    await tx.order.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    await writeActivity({ ...actorAudit(actor), action: "ORDER_UPDATED", entityType: "Order", entityId: orderId, deviceId: context.deviceId, operationId: context.operationId, beforeData: { removedOrderItemId: itemId, quantity: item.quantity } }, tx);
  }, existingTx);
}

export function requestBill(orderId: string, expectedVersion: number, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, orderId, expectedVersion);
    assertOrderTransition(order.status, "BILL_REQUESTED");
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: "BILL_REQUESTED", version: { increment: 1 } } });
    const assignments = await tx.orderTableAssignment.findMany({ where: { orderId, releasedAt: null }, select: { tableId: true } });
    await tx.diningTable.updateMany({ where: { id: { in: assignments.map(({ tableId }) => tableId) } }, data: { status: "BILL_REQUESTED" } });
    await writeActivity({ ...actorAudit(actor), action: "ORDER_UPDATED", entityType: "Order", entityId: orderId, deviceId: context.deviceId, operationId: context.operationId, beforeData: { status: order.status }, afterData: { status: updated.status } }, tx);
    return updated;
  }, existingTx);
}

export function transferOrder(orderId: string, input: { expectedVersion: number; destinationTableId: string }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, orderId, input.expectedVersion);
    posAssert(["OPEN", "BILL_REQUESTED"].includes(order.status), "ORDER_NOT_OPEN", "Order cannot be transferred in its current state");
    const destination = await tx.diningTable.findUnique({ where: { id: input.destinationTableId } });
    posAssert(destination, "TABLE_NOT_FOUND", "Destination table not found");
    posAssert(destination.isActive && destination.status !== "DISABLED", "TABLE_DISABLED", "Destination table is disabled");
    const destinationAssignment = await tx.orderTableAssignment.findFirst({ where: { tableId: destination.id, releasedAt: null } });
    posAssert(!destinationAssignment, "TABLE_OCCUPIED", "Destination table is occupied");
    const current = await tx.orderTableAssignment.findFirst({ where: { orderId, releasedAt: null, isPrimary: true }, include: { table: true } });
    posAssert(current, "TABLE_NOT_FOUND", "Order has no active primary table");
    const now = new Date();
    await tx.orderTableAssignment.update({ where: { id: current.id }, data: { releasedAt: now, releasedById: actor.id, releasedByNameSnapshot: actor.name, releasedByRoleSnapshot: actor.role } });
    await tx.orderTableAssignment.create({ data: { orderId, tableId: destination.id, assignedById: actor.id, assignedByNameSnapshot: actor.name, assignedByRoleSnapshot: actor.role, isPrimary: true } });
    await tx.diningTable.update({ where: { id: current.tableId }, data: { status: "AVAILABLE" } });
    await tx.diningTable.update({ where: { id: destination.id }, data: { status: order.status === "BILL_REQUESTED" ? "BILL_REQUESTED" : "OCCUPIED" } });
    const updated = await tx.order.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    await writeActivity({ ...actorAudit(actor), action: "TABLE_TRANSFERRED", entityType: "Order", entityId: orderId, deviceId: context.deviceId, operationId: context.operationId, beforeData: { tableId: current.tableId, tableCode: current.table.code }, afterData: { tableId: destination.id, tableCode: destination.code } }, tx);
    return updated;
  }, existingTx);
}

export function mergeOrders(survivingOrderId: string, input: { expectedVersion: number; sourceOrderIds: string[] }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const survivor = await assertOrderVersion(tx, survivingOrderId, input.expectedVersion);
    posAssert(["OPEN", "BILL_REQUESTED"].includes(survivor.status), "ORDER_NOT_OPEN", "Surviving order is not mergeable");
    const uniqueSources = [...new Set(input.sourceOrderIds)].filter((id) => id !== survivingOrderId);
    posAssert(uniqueSources.length > 0, "INVALID_ORDER_STATE", "At least one source order is required");
    const sources = await tx.order.findMany({ where: { id: { in: uniqueSources } }, include: { tables: { where: { releasedAt: null } } } });
    posAssert(sources.length === uniqueSources.length, "ORDER_NOT_FOUND", "Source order not found");
    posAssert(sources.every((order) => ["OPEN", "BILL_REQUESTED"].includes(order.status)), "INVALID_ORDER_STATE", "Only open or bill-requested orders can merge");
    const billed = await tx.invoiceOrder.findFirst({ where: { orderId: { in: uniqueSources } } });
    posAssert(!billed, "INVALID_ORDER_STATE", "A billed order cannot be merged");
    await tx.orderItem.updateMany({ where: { orderId: { in: uniqueSources } }, data: { orderId: survivingOrderId } });
    const now = new Date();
    for (const source of sources) {
      for (const assignment of source.tables) {
        await tx.orderTableAssignment.update({ where: { id: assignment.id }, data: { releasedAt: now, releasedById: actor.id, releasedByNameSnapshot: actor.name, releasedByRoleSnapshot: actor.role } });
        await tx.orderTableAssignment.create({ data: { orderId: survivingOrderId, tableId: assignment.tableId, assignedById: actor.id, assignedByNameSnapshot: actor.name, assignedByRoleSnapshot: actor.role, isPrimary: false } });
      }
      await tx.order.update({ where: { id: source.id }, data: { status: "MERGED", mergedIntoOrderId: survivingOrderId, closedAt: now, version: { increment: 1 } } });
    }
    const updated = await tx.order.update({ where: { id: survivingOrderId }, data: { version: { increment: 1 }, guestCount: sources.reduce((sum, order) => sum + (order.guestCount ?? 0), survivor.guestCount ?? 0) || null } });
    await writeActivity({ ...actorAudit(actor), action: "TABLES_MERGED", entityType: "Order", entityId: survivingOrderId, deviceId: context.deviceId, operationId: context.operationId, metadata: { sourceOrderIds: uniqueSources } }, tx);
    return updated;
  }, existingTx);
}

export type ApplyDiscountInput =
  | { expectedVersion: number; type: "PERCENTAGE"; percentageBasisPoints: number; reason: string }
  | { expectedVersion: number; type: "FIXED"; fixedAmountMinor: bigint; reason: string };

export function applyOrderDiscount(orderId: string, input: ApplyDiscountInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    posAssert(actor.role === "SUPER_ADMIN", "DISCOUNT_NOT_ALLOWED", "Only the main admin may apply discounts");
    const order = await assertOrderVersion(tx, orderId, input.expectedVersion);
    posAssert(["OPEN", "BILL_REQUESTED"].includes(order.status), "ORDER_NOT_OPEN", "Order is not discountable");
    const aggregate = await tx.orderItem.aggregate({ where: { orderId }, _sum: { lineTotalMinor: true } });
    const subtotalMinor = aggregate._sum.lineTotalMinor ?? 0n;
    const request: DiscountRequest = input.type === "PERCENTAGE"
      ? { type: "PERCENTAGE", percentageBasisPoints: BigInt(input.percentageBasisPoints) }
      : { type: "FIXED", fixedAmountMinor: input.fixedAmountMinor };
    const existing = await tx.orderDiscount.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
    const existingRequests = existing.map((discount): DiscountRequest => discount.type === "PERCENTAGE"
      ? { type: "PERCENTAGE", percentageBasisPoints: BigInt(discount.percentageBasisPoints!) }
      : { type: "FIXED", fixedAmountMinor: discount.fixedAmountMinor! });
    const totals = calculateInvoiceTotals([subtotalMinor], [...existingRequests, request]);
    const calculatedAmountMinor = totals.discountAmounts.at(-1)!;
    const discount = await tx.orderDiscount.create({ data: {
      orderId,
      type: input.type,
      percentageBasisPoints: input.type === "PERCENTAGE" ? input.percentageBasisPoints : null,
      fixedAmountMinor: input.type === "FIXED" ? input.fixedAmountMinor : null,
      calculatedAmountMinor,
      reason: input.reason.trim(),
      actorId: actor.id,
      actorNameSnapshot: actor.name,
      actorRoleSnapshot: actor.role,
    } });
    await tx.order.update({ where: { id: orderId }, data: { version: { increment: 1 } } });
    await writeActivity({ ...actorAudit(actor), action: "DISCOUNT_APPLIED", entityType: "Order", entityId: orderId, deviceId: context.deviceId, operationId: context.operationId, reason: input.reason, afterData: { discountId: discount.id, type: discount.type, calculatedAmountMinor: calculatedAmountMinor.toString() } }, tx);
    return discount;
  }, existingTx);
}

async function nextInvoiceNumber(tx: PosTx, deviceCode: string, businessDate: Date, supplied?: string) {
  const year = businessDate.getUTCFullYear();
  const prefix = `RWQ-${deviceCode}-${year}-`;
  if (supplied) {
    posAssert(new RegExp(`^RWQ-${deviceCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-${year}-\\d{6}$`).test(supplied), "SYNC_CONFLICT", "Invoice number does not match device/year format");
    return supplied;
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rawaqan:${prefix}`}))`;
  const latest = await tx.invoice.findFirst({ where: { invoiceNumber: { startsWith: prefix } }, orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  const next = latest ? Number(latest.invoiceNumber.slice(prefix.length)) + 1 : 1;
  posAssert(next <= 999_999, "SYNC_CONFLICT", "Invoice sequence exhausted for this device/year");
  return `${prefix}${next.toString().padStart(6, "0")}`;
}

export interface FinalizeInvoiceInput {
  id?: string;
  orderId: string;
  expectedVersion: number;
  invoiceNumber?: string;
  lines?: { orderItemId: string; quantity: number }[];
  payments?: (PaymentAllocation & { id?: string })[];
  split?: { groupId: string; index: number; count: number };
}

export function finalizeInvoice(input: FinalizeInvoiceInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, input.orderId, input.expectedVersion);
    posAssert(["OPEN", "BILL_REQUESTED", "PARTIALLY_BILLED"].includes(order.status), "INVALID_ORDER_STATE", "Order cannot be invoiced in its current state");
    if (input.split) posAssert(Number.isInteger(input.split.index) && Number.isInteger(input.split.count) && input.split.count >= 2 && input.split.index >= 1 && input.split.index <= input.split.count, "INVALID_QUANTITY", "Item split metadata is invalid");
    if (input.split) {
      const siblings = await tx.invoice.findMany({ where: { splitGroupId: input.split.groupId }, select: { splitMode: true, splitCount: true } });
      posAssert(siblings.every((sibling) => sibling.splitMode === "ITEM" && sibling.splitCount === input.split!.count), "INVALID_QUANTITY", "Item split group metadata is inconsistent");
    }
    const items = await tx.orderItem.findMany({ where: { orderId: order.id }, include: { modifiers: true }, orderBy: { sortOrder: "asc" } });
    posAssert(items.length > 0, "INVALID_ORDER_STATE", "Cannot invoice an empty order");
    const [billed, rationalBilled] = await Promise.all([
      tx.invoiceLine.findMany({ where: { orderItem: { orderId: order.id }, invoice: { status: { not: "VOIDED" } } }, select: { orderItemId: true, quantity: true } }),
      tx.invoiceAllocationLine.findMany({ where: { orderItem: { orderId: order.id }, invoice: { status: { not: "VOIDED" } } }, select: { orderItemId: true, quantityNumerator: true, quantityDenominator: true } }),
    ]);
    const billedByItem = new Map<string, number>();
    for (const line of billed) if (line.orderItemId) billedByItem.set(line.orderItemId, (billedByItem.get(line.orderItemId) ?? 0) + line.quantity);
    const rationalByItem = new Map<string, RationalQuantity>();
    for (const line of rationalBilled) rationalByItem.set(line.orderItemId, addRational(rationalByItem.get(line.orderItemId) ?? { numerator: 0n, denominator: 1n }, { numerator: line.quantityNumerator, denominator: line.quantityDenominator }));
    for (const [itemId, quantity] of rationalByItem) {
      const reduced = reduceRational(quantity);
      posAssert(reduced.denominator === 1n && reduced.numerator <= BigInt(Number.MAX_SAFE_INTEGER), "INVALID_QUANTITY", "A rational split must be completed or voided before item billing");
      billedByItem.set(itemId, (billedByItem.get(itemId) ?? 0) + Number(reduced.numerator));
    }
    const requested = new Map((input.lines ?? items.map((item) => ({ orderItemId: item.id, quantity: item.quantity - (billedByItem.get(item.id) ?? 0) }))).map((line) => [line.orderItemId, line.quantity]));
    const invoiceItems = items.flatMap((item) => {
      const quantity = requested.get(item.id) ?? 0;
      posAssert(Number.isInteger(quantity) && quantity >= 0, "INVALID_QUANTITY", "Invoice line quantity is invalid");
      posAssert(quantity <= item.quantity - (billedByItem.get(item.id) ?? 0), "INVALID_QUANTITY", "Invoice quantity exceeds unbilled quantity");
      return quantity > 0 ? [{ item, quantity }] : [];
    });
    posAssert(invoiceItems.length > 0, "INVALID_QUANTITY", "No unbilled quantity selected");
    posAssert([...requested.keys()].every((id) => items.some((item) => item.id === id)), "INVALID_QUANTITY", "Unknown order item in split");
    const discounts = await tx.orderDiscount.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    const fullRemaining = items.every((item) => (requested.get(item.id) ?? 0) === item.quantity - (billedByItem.get(item.id) ?? 0));
    posAssert(discounts.length === 0 || (billed.length === 0 && fullRemaining), "INVALID_DISCOUNT", "Discounted orders must be finalized in one invoice");
    const discountRequests = discounts.map((discount): DiscountRequest => discount.type === "PERCENTAGE"
      ? { type: "PERCENTAGE", percentageBasisPoints: BigInt(discount.percentageBasisPoints!) }
      : { type: "FIXED", fixedAmountMinor: discount.fixedAmountMinor! });
    const totals = calculateInvoiceTotals(invoiceItems.map(({ item, quantity }) => item.unitPriceMinor * BigInt(quantity)), discountRequests);
    const businessDate = await getBusinessDate(tx);
    const invoiceNumber = await nextInvoiceNumber(tx, device.code, businessDate, input.invoiceNumber);
    const tableAssignments = await tx.orderTableAssignment.findMany({ where: { orderId: order.id, releasedAt: null }, include: { table: true } });
    const invoice = await tx.invoice.create({
      data: {
        id: input.id,
        invoiceNumber,
        businessDate,
        subtotalMinor: totals.subtotalMinor,
        discountMinor: totals.discountMinor,
        totalMinor: totals.totalMinor,
        splitGroupId: input.split?.groupId,
        splitMode: input.split ? "ITEM" : undefined,
        splitIndex: input.split?.index,
        splitCount: input.split?.count,
        cashierId: actor.id,
        cashierNameSnapshot: actor.name,
        cashierRoleSnapshot: actor.role,
        deviceId: device.id,
        orders: { create: { orderId: order.id } },
        tableSnapshots: { create: tableAssignments.map(({ table }) => ({ tableId: table.id, tableCodeSnapshot: table.code, tableDisplayNameSnapshot: table.displayName, tableCapacitySnapshot: table.capacity })) },
        lines: { create: invoiceItems.map(({ item, quantity }) => ({
          orderItemId: item.id,
          menuItemId: item.menuItemId,
          itemNameSnapshot: item.itemNameSnapshot,
          itemNameEnSnapshot: item.itemNameEnSnapshot,
          unitPriceMinor: item.unitPriceMinor,
          quantity,
          subtotalMinor: item.unitPriceMinor * BigInt(quantity),
          totalMinor: item.unitPriceMinor * BigInt(quantity),
          notes: item.notes,
          sortOrder: item.sortOrder,
          modifiers: { create: item.modifiers.map((modifier) => ({ modifierOptionId: modifier.modifierOptionId, groupNameSnapshot: modifier.groupNameSnapshot, groupNameEnSnapshot: modifier.groupNameEnSnapshot, optionNameSnapshot: modifier.optionNameSnapshot, optionNameEnSnapshot: modifier.optionNameEnSnapshot, priceTypeSnapshot: modifier.priceTypeSnapshot, unitPriceMinor: modifier.unitPriceMinor, quantity: modifier.quantity, totalMinor: modifier.lineTotalMinor })) },
        })) },
        discounts: { create: discounts.map((discount, index) => ({ type: discount.type, percentageBasisPoints: discount.percentageBasisPoints, fixedAmountMinor: discount.fixedAmountMinor, calculatedAmountMinor: totals.discountAmounts[index], reason: discount.reason, actorId: discount.actorId, actorNameSnapshot: discount.actorNameSnapshot, actorRoleSnapshot: discount.actorRoleSnapshot })) },
      },
      include: { lines: { include: { modifiers: true } }, discounts: true, tableSnapshots: true },
    });

    let allocatedMinor = 0n;
    if (input.payments?.length) {
      const validated = validatePayments(invoice.totalMinor, input.payments, false);
      allocatedMinor = validated.allocatedMinor;
      const shift = await tx.cashierShift.findFirst({ where: { userId: actor.id, deviceId: device.id, status: "OPEN" } });
      posAssert(shift, "SHIFT_REQUIRED", "An open cashier shift is required before payment");
      for (const [index, payment] of validated.payments.entries()) {
        const created = await tx.payment.create({ data: { id: input.payments[index]?.id, invoiceId: invoice.id, method: payment.method, amountMinor: payment.amountMinor, tenderedMinor: payment.method === "CASH" ? payment.tenderedMinor : null, changeMinor: payment.changeMinor, actorId: actor.id, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, deviceId: device.id } });
        await writeActivity({ ...actorAudit(actor), action: "PAYMENT_CREATED", entityType: "Payment", entityId: created.id, deviceId: device.id, operationId: context.operationId, afterData: { invoiceId: invoice.id, method: created.method, amountMinor: created.amountMinor.toString() } }, tx);
      }
      const cashMinor = sumMinorUnits(validated.payments.filter((payment) => payment.method === "CASH").map((payment) => payment.amountMinor));
      if (cashMinor > 0n) await tx.cashierShift.update({ where: { id: shift.id }, data: { cashSalesMinor: { increment: cashMinor }, expectedCashMinor: { increment: cashMinor } } });
    }
    const paid = allocatedMinor === invoice.totalMinor;
    if (paid) await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });
    const orderStatus = paid && fullRemaining ? "CLOSED" : "PARTIALLY_BILLED";
    await tx.order.update({ where: { id: order.id }, data: { status: orderStatus, version: { increment: 1 }, closedAt: orderStatus === "CLOSED" ? new Date() : null } });
    if (orderStatus === "CLOSED") await releaseOrderTables(tx, order.id, actor);
    await writeActivity({ ...actorAudit(actor), action: "INVOICE_CREATED", entityType: "Invoice", entityId: invoice.id, deviceId: device.id, operationId: context.operationId, afterData: { invoiceNumber, subtotalMinor: totals.subtotalMinor.toString(), discountMinor: totals.discountMinor.toString(), totalMinor: totals.totalMinor.toString(), status: paid ? "PAID" : "OPEN" } }, tx);
    return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: invoiceInclude });
  }, existingTx);
}

export interface EqualSplitInvoiceRequest {
  id?: string;
  invoiceNumber?: string;
  payments?: (PaymentAllocation & { id?: string })[];
  allocations?: { orderItemId: string; quantityNumerator: bigint; quantityDenominator: bigint }[];
}

export interface FinalizeEqualSplitInput {
  orderId: string;
  expectedVersion: number;
  splitGroupId?: string;
  splitCount: number;
  invoices?: EqualSplitInvoiceRequest[];
}

export function finalizeEqualSplit(input: FinalizeEqualSplitInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    const order = await assertOrderVersion(tx, input.orderId, input.expectedVersion);
    posAssert(["OPEN", "BILL_REQUESTED"].includes(order.status), "INVALID_ORDER_STATE", "Only an unsplit open bill can be split equally");
    posAssert(Number.isInteger(input.splitCount) && input.splitCount >= 2 && input.splitCount <= 50, "INVALID_QUANTITY", "Equal split count must be between 2 and 50");
    posAssert(!input.invoices || input.invoices.length === input.splitCount, "INVALID_QUANTITY", "Invoice request count must match split count");
    const requestedIds = (input.invoices ?? []).flatMap((request) => request.id ? [request.id] : []);
    const requestedNumbers = (input.invoices ?? []).flatMap((request) => request.invoiceNumber ? [request.invoiceNumber] : []);
    posAssert(new Set(requestedIds).size === requestedIds.length && new Set(requestedNumbers).size === requestedNumbers.length, "SYNC_CONFLICT", "Split invoice identifiers must be unique");

    const [items, existingLine, existingAllocation] = await Promise.all([
      tx.orderItem.findMany({ where: { orderId: order.id }, include: { modifiers: true }, orderBy: { sortOrder: "asc" } }),
      tx.invoiceLine.findFirst({ where: { orderItem: { orderId: order.id }, invoice: { status: { not: "VOIDED" } } }, select: { id: true } }),
      tx.invoiceAllocationLine.findFirst({ where: { orderItem: { orderId: order.id }, invoice: { status: { not: "VOIDED" } } }, select: { id: true } }),
    ]);
    posAssert(items.length > 0, "INVALID_ORDER_STATE", "Cannot split an empty order");
    posAssert(!existingLine && !existingAllocation, "INVALID_ORDER_STATE", "An already billed order cannot be split equally");
    for (const request of input.invoices ?? []) {
      if (!request.allocations) continue;
      posAssert(request.allocations.length === items.length, "INVALID_QUANTITY", "Every equal-split invoice must allocate every order item");
      const byItem = new Map(request.allocations.map((allocation) => [allocation.orderItemId, allocation]));
      posAssert(byItem.size === items.length && items.every((item) => {
        const allocation = byItem.get(item.id);
        return allocation?.quantityNumerator === BigInt(item.quantity) && allocation.quantityDenominator === BigInt(input.splitCount);
      }), "INVALID_QUANTITY", "Equal-split rational allocation does not match the order");
    }

    const discounts = await tx.orderDiscount.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    const discountRequests = discounts.map((discount): DiscountRequest => discount.type === "PERCENTAGE"
      ? { type: "PERCENTAGE", percentageBasisPoints: BigInt(discount.percentageBasisPoints!) }
      : { type: "FIXED", fixedAmountMinor: discount.fixedAmountMinor! });
    const totals = calculateInvoiceTotals(items.map((item) => item.unitPriceMinor * BigInt(item.quantity)), discountRequests);
    const totalShares = splitEqual(totals.totalMinor, input.splitCount);
    const discountShares = splitEqual(totals.discountMinor, input.splitCount);
    const subtotalShares = totalShares.map((total, index) => total + discountShares[index]!);
    const lineMatrix = allocateLinesToTargets(items.map((item) => item.unitPriceMinor * BigInt(item.quantity)), subtotalShares).lineAllocations;
    const discountMatrix = totals.discountAmounts.length
      ? allocateLinesToTargets(totals.discountAmounts, discountShares).lineAllocations
      : [];
    const businessDate = await getBusinessDate(tx);
    const tableAssignments = await tx.orderTableAssignment.findMany({ where: { orderId: order.id, releasedAt: null }, include: { table: true } });
    const splitGroupId = input.splitGroupId ?? randomUUID();
    posAssert(await tx.invoice.count({ where: { splitGroupId } }) === 0, "SYNC_CONFLICT", "Split group identity is already in use");
    const createdInvoices = [];
    let allPaid = true;

    for (let splitOffset = 0; splitOffset < input.splitCount; splitOffset += 1) {
      const request = input.invoices?.[splitOffset];
      const invoiceNumber = await nextInvoiceNumber(tx, device.code, businessDate, request?.invoiceNumber);
      const lineSubtotals = items.map((_item, itemIndex) => lineMatrix[itemIndex]![splitOffset]!);
      const lineDiscounts = allocateDiscountAcrossLines(lineSubtotals, discountShares[splitOffset]!);
      const invoice = await tx.invoice.create({
        data: {
          id: request?.id,
          invoiceNumber,
          businessDate,
          subtotalMinor: subtotalShares[splitOffset]!,
          discountMinor: discountShares[splitOffset]!,
          totalMinor: totalShares[splitOffset]!,
          splitGroupId,
          splitMode: "EQUAL",
          splitIndex: splitOffset + 1,
          splitCount: input.splitCount,
          cashierId: actor.id,
          cashierNameSnapshot: actor.name,
          cashierRoleSnapshot: actor.role,
          deviceId: device.id,
          orders: { create: { orderId: order.id } },
          tableSnapshots: { create: tableAssignments.map(({ table }) => ({ tableId: table.id, tableCodeSnapshot: table.code, tableDisplayNameSnapshot: table.displayName, tableCapacitySnapshot: table.capacity })) },
          allocationLines: { create: items.map((item, itemIndex) => ({
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            itemNameSnapshot: item.itemNameSnapshot,
            itemNameEnSnapshot: item.itemNameEnSnapshot,
            unitPriceMinor: item.unitPriceMinor,
            quantityNumerator: BigInt(item.quantity),
            quantityDenominator: BigInt(input.splitCount),
            subtotalMinor: lineSubtotals[itemIndex]!,
            discountMinor: lineDiscounts[itemIndex]!,
            totalMinor: lineSubtotals[itemIndex]! - lineDiscounts[itemIndex]!,
            notes: item.notes,
            sortOrder: item.sortOrder,
            modifiers: { create: item.modifiers.map((modifier) => ({ modifierOptionId: modifier.modifierOptionId, groupNameSnapshot: modifier.groupNameSnapshot, groupNameEnSnapshot: modifier.groupNameEnSnapshot, optionNameSnapshot: modifier.optionNameSnapshot, optionNameEnSnapshot: modifier.optionNameEnSnapshot, priceTypeSnapshot: modifier.priceTypeSnapshot, unitPriceMinor: modifier.unitPriceMinor, quantity: modifier.quantity, totalMinor: modifier.lineTotalMinor })) },
          })) },
          discounts: { create: discounts.map((discount, discountIndex) => ({ type: discount.type, percentageBasisPoints: discount.percentageBasisPoints, fixedAmountMinor: discount.fixedAmountMinor, calculatedAmountMinor: discountMatrix[discountIndex]![splitOffset]!, reason: discount.reason, actorId: discount.actorId, actorNameSnapshot: discount.actorNameSnapshot, actorRoleSnapshot: discount.actorRoleSnapshot })) },
        },
        include: invoiceInclude,
      });

      let allocatedMinor = 0n;
      if (request?.payments?.length) {
        const validated = validatePayments(invoice.totalMinor, request.payments, false);
        allocatedMinor = validated.allocatedMinor;
        const shift = await tx.cashierShift.findFirst({ where: { userId: actor.id, deviceId: device.id, status: "OPEN" } });
        posAssert(shift, "SHIFT_REQUIRED", "An open cashier shift is required before payment");
        for (const [paymentIndex, payment] of validated.payments.entries()) {
          const created = await tx.payment.create({ data: { id: request.payments[paymentIndex]?.id, invoiceId: invoice.id, method: payment.method, amountMinor: payment.amountMinor, tenderedMinor: payment.method === "CASH" ? payment.tenderedMinor : null, changeMinor: payment.changeMinor, actorId: actor.id, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, deviceId: device.id } });
          await writeActivity({ ...actorAudit(actor), action: "PAYMENT_CREATED", entityType: "Payment", entityId: created.id, deviceId: device.id, operationId: context.operationId, afterData: { invoiceId: invoice.id, method: created.method, amountMinor: created.amountMinor.toString() } }, tx);
        }
        const cashMinor = sumMinorUnits(validated.payments.filter((payment) => payment.method === "CASH").map((payment) => payment.amountMinor));
        if (cashMinor > 0n) await tx.cashierShift.update({ where: { id: shift.id }, data: { cashSalesMinor: { increment: cashMinor }, expectedCashMinor: { increment: cashMinor } } });
      }
      const paid = allocatedMinor === invoice.totalMinor;
      allPaid = allPaid && paid;
      if (paid) await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });
      await writeActivity({ ...actorAudit(actor), action: "INVOICE_CREATED", entityType: "Invoice", entityId: invoice.id, deviceId: device.id, operationId: context.operationId, afterData: { invoiceNumber, splitGroupId, splitMode: "EQUAL", splitIndex: splitOffset + 1, splitCount: input.splitCount, totalMinor: invoice.totalMinor.toString(), status: paid ? "PAID" : "OPEN" } }, tx);
      createdInvoices.push(await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: invoiceInclude }));
    }

    const orderStatus = allPaid ? "CLOSED" : "PARTIALLY_BILLED";
    await tx.order.update({ where: { id: order.id }, data: { status: orderStatus, version: { increment: 1 }, closedAt: allPaid ? new Date() : null } });
    if (allPaid) await releaseOrderTables(tx, order.id, actor);
    return { splitGroupId, splitMode: "EQUAL" as const, splitCount: input.splitCount, invoices: createdInvoices };
  }, existingTx);
}

const invoiceInclude = {
  lines: { include: { modifiers: true } },
  allocationLines: { include: { modifiers: true } },
  discounts: true,
  payments: true,
  refunds: { include: { lines: true, payments: true } },
  tableSnapshots: true,
  orders: true,
  void: true,
  printEvents: true,
} satisfies Prisma.InvoiceInclude;

async function releaseOrderTables(tx: PosTx, orderId: string, actor: ActorSnapshot) {
  const assignments = await tx.orderTableAssignment.findMany({ where: { orderId, releasedAt: null } });
  const now = new Date();
  for (const assignment of assignments) {
    await tx.orderTableAssignment.update({ where: { id: assignment.id }, data: { releasedAt: now, releasedById: actor.id, releasedByNameSnapshot: actor.name, releasedByRoleSnapshot: actor.role } });
    const stillOccupied = await tx.orderTableAssignment.findFirst({ where: { tableId: assignment.tableId, releasedAt: null } });
    if (!stillOccupied) await tx.diningTable.update({ where: { id: assignment.tableId }, data: { status: "AVAILABLE" } });
  }
}

export type CreatePaymentInput = PaymentAllocation & { id?: string };

export function createPayment(invoiceId: string, input: CreatePaymentInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true, orders: true } });
    posAssert(invoice, "INVOICE_NOT_FOUND", "Invoice not found");
    posAssert(invoice.status === "OPEN", invoice.status === "PAID" ? "INVOICE_ALREADY_PAID" : "INVOICE_ALREADY_VOIDED", "Invoice does not accept payments");
    const alreadyPaid = sumMinorUnits(invoice.payments.filter((payment) => payment.status === "COMPLETED").map((payment) => payment.amountMinor));
    const due = invoice.totalMinor - alreadyPaid;
    const validated = validatePayments(due, [input], false);
    const shift = await tx.cashierShift.findFirst({ where: { userId: actor.id, deviceId: device.id, status: "OPEN" } });
    posAssert(shift, "SHIFT_REQUIRED", "An open cashier shift is required before payment");
    const payment = validated.payments[0]!;
    const created = await tx.payment.create({ data: {
      id: input.id,
      invoiceId,
      method: payment.method,
      amountMinor: payment.amountMinor,
      tenderedMinor: payment.method === "CASH" ? payment.tenderedMinor : null,
      changeMinor: payment.changeMinor,
      actorId: actor.id,
      actorNameSnapshot: actor.name,
      actorRoleSnapshot: actor.role,
      deviceId: device.id,
    } });
    if (payment.method === "CASH") await tx.cashierShift.update({ where: { id: shift.id }, data: { cashSalesMinor: { increment: payment.amountMinor }, expectedCashMinor: { increment: payment.amountMinor } } });
    const fullyPaid = alreadyPaid + payment.amountMinor === invoice.totalMinor;
    if (fullyPaid) {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } });
      for (const link of invoice.orders) {
        if (await isOrderFullyBilled(tx, link.orderId)) {
          const order = await tx.order.findUniqueOrThrow({ where: { id: link.orderId } });
          if (order.status !== "CLOSED") {
            await tx.order.update({ where: { id: order.id }, data: { status: "CLOSED", closedAt: new Date(), version: { increment: 1 } } });
            await releaseOrderTables(tx, order.id, actor);
          }
        }
      }
    }
    await writeActivity({ ...actorAudit(actor), action: "PAYMENT_CREATED", entityType: "Payment", entityId: created.id, deviceId: device.id, operationId: context.operationId, afterData: { invoiceId, method: created.method, amountMinor: created.amountMinor.toString(), invoicePaid: fullyPaid } }, tx);
    return created;
  }, existingTx);
}

async function isOrderFullyBilled(tx: PosTx, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { id: true, quantity: true } });
  const [lines, allocationLines, openInvoices] = await Promise.all([
    tx.invoiceLine.findMany({ where: { orderItemId: { in: items.map((item) => item.id) }, invoice: { status: { not: "VOIDED" } } }, select: { orderItemId: true, quantity: true } }),
    tx.invoiceAllocationLine.findMany({ where: { orderItemId: { in: items.map((item) => item.id) }, invoice: { status: { not: "VOIDED" } } }, select: { orderItemId: true, quantityNumerator: true, quantityDenominator: true } }),
    tx.invoice.count({ where: { orders: { some: { orderId } }, status: "OPEN" } }),
  ]);
  if (openInvoices > 0) return false;
  return items.every((item) => {
    let allocated: RationalQuantity = { numerator: BigInt(lines.filter((line) => line.orderItemId === item.id).reduce((sum, line) => sum + line.quantity, 0)), denominator: 1n };
    for (const line of allocationLines.filter((line) => line.orderItemId === item.id)) allocated = addRational(allocated, { numerator: line.quantityNumerator, denominator: line.quantityDenominator });
    return compareRational(allocated, { numerator: BigInt(item.quantity), denominator: 1n }) === 0;
  });
}

export function voidInvoice(invoiceId: string, input: { id?: string; reason: string }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    posAssert(actor.role === "SUPER_ADMIN", "DISCOUNT_NOT_ALLOWED", "Only the main admin may void invoices");
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true, orders: true, void: true } });
    posAssert(invoice, "INVOICE_NOT_FOUND", "Invoice not found");
    posAssert(!invoice.void && invoice.status !== "VOIDED", "INVOICE_ALREADY_VOIDED", "Invoice is already voided");
    posAssert(!invoice.splitGroupId, "INVALID_ORDER_STATE", "Split invoices cannot be voided individually");
    posAssert(invoice.status === "OPEN" && invoice.payments.length === 0, "INVALID_ORDER_STATE", "Only an unpaid invoice may be voided; use a refund for paid invoices");
    const record = await tx.invoiceVoid.create({ data: { id: input.id, invoiceId, reason: input.reason.trim(), actorId: actor.id, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, deviceId: device.id, operationId: context.operationId } });
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "VOIDED" } });
    for (const link of invoice.orders) {
      const order = await tx.order.findUniqueOrThrow({ where: { id: link.orderId } });
      if (order.status === "PARTIALLY_BILLED" && !(await isOrderFullyBilled(tx, order.id))) {
        await tx.order.update({ where: { id: order.id }, data: { status: "BILL_REQUESTED", version: { increment: 1 } } });
      }
    }
    await writeActivity({ ...actorAudit(actor), action: "INVOICE_VOIDED", entityType: "Invoice", entityId: invoiceId, deviceId: device.id, operationId: context.operationId, reason: input.reason, beforeData: { status: invoice.status }, afterData: { status: "VOIDED", voidId: record.id } }, tx);
    return record;
  }, existingTx);
}

export interface RefundInvoiceInput {
  id?: string;
  amountMinor: bigint;
  reason: string;
  lines?: { id?: string; invoiceLineId: string; quantity: number; amountMinor: bigint }[];
  payments?: { id?: string; paymentId: string; amountMinor: bigint }[];
}

export function refundInvoice(invoiceId: string, input: RefundInvoiceInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    posAssert(actor.role === "SUPER_ADMIN", "DISCOUNT_NOT_ALLOWED", "Only the main admin may refund invoices");
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { lines: true, payments: { include: { refundPayments: true } } } });
    posAssert(invoice, "INVOICE_NOT_FOUND", "Invoice not found");
    posAssert(["PAID", "PARTIALLY_REFUNDED"].includes(invoice.status), "INVALID_ORDER_STATE", "Only paid invoices may be refunded");
    validateRefund(invoice.totalMinor, invoice.refundedMinor, input.amountMinor);
    const lineMap = new Map(invoice.lines.map((line) => [line.id, line]));
    if (input.lines?.length) {
      posAssert(invoice.splitMode !== "EQUAL", "INVALID_QUANTITY", "Equal-split invoices support invoice-level monetary refunds only in this version");
      posAssert(sumMinorUnits(input.lines.map((line) => line.amountMinor)) === input.amountMinor, "REFUND_EXCEEDS_AVAILABLE", "Refund line allocation must equal refund amount");
      for (const line of input.lines) {
        const source = lineMap.get(line.invoiceLineId);
        posAssert(source && line.quantity > 0 && line.quantity <= source.quantity && line.amountMinor > 0n, "REFUND_EXCEEDS_AVAILABLE", "Invalid refund line allocation");
      }
    }
    const availablePayments = invoice.payments.map((payment) => ({ payment, available: payment.amountMinor - sumMinorUnits(payment.refundPayments.map((allocation) => allocation.amountMinor)) }));
    let paymentAllocations = input.payments;
    if (!paymentAllocations?.length) {
      let remaining = input.amountMinor;
      paymentAllocations = [];
      for (const { payment, available } of availablePayments) {
        const amountMinor = available < remaining ? available : remaining;
        if (amountMinor > 0n) paymentAllocations.push({ paymentId: payment.id, amountMinor });
        remaining -= amountMinor;
        if (remaining === 0n) break;
      }
    }
    posAssert(sumMinorUnits(paymentAllocations.map((allocation) => allocation.amountMinor)) === input.amountMinor, "REFUND_EXCEEDS_AVAILABLE", "Refund payment allocation must equal refund amount");
    for (const allocation of paymentAllocations) {
      const source = availablePayments.find(({ payment }) => payment.id === allocation.paymentId);
      posAssert(source && allocation.amountMinor > 0n && allocation.amountMinor <= source.available, "REFUND_EXCEEDS_AVAILABLE", "Refund exceeds payment allocation");
    }
    const refund = await tx.refund.create({ data: {
      id: input.id,
      invoiceId,
      amountMinor: input.amountMinor,
      reason: input.reason.trim(),
      actorId: actor.id,
      actorNameSnapshot: actor.name,
      actorRoleSnapshot: actor.role,
      deviceId: device.id,
      operationId: context.operationId,
      lines: input.lines?.length ? { create: input.lines.map((line) => ({ id: line.id, invoiceLineId: line.invoiceLineId, quantity: line.quantity, amountMinor: line.amountMinor })) } : undefined,
      payments: { create: paymentAllocations.map((allocation) => ({ id: allocation.id, paymentId: allocation.paymentId, amountMinor: allocation.amountMinor })) },
    }, include: { lines: true, payments: true } });
    const cumulative = invoice.refundedMinor + input.amountMinor;
    await tx.invoice.update({ where: { id: invoiceId }, data: { refundedMinor: cumulative, status: invoiceStatusForRefund(invoice.totalMinor, cumulative) } });
    let cashRefundMinor = 0n;
    for (const allocation of paymentAllocations) {
      const source = availablePayments.find(({ payment }) => payment.id === allocation.paymentId)!;
      if (source.payment.method === "CASH") cashRefundMinor += allocation.amountMinor;
      if (allocation.amountMinor === source.available) await tx.payment.update({ where: { id: source.payment.id }, data: { status: "REFUNDED" } });
    }
    if (cashRefundMinor > 0n) {
      const shift = await tx.cashierShift.findFirst({ where: { userId: actor.id, deviceId: device.id, status: "OPEN" } });
      posAssert(shift, "SHIFT_REQUIRED", "An open shift is required for a cash refund");
      posAssert(shift.expectedCashMinor >= cashRefundMinor, "INVALID_PAYMENT_TOTAL", "Cash refund exceeds expected drawer cash");
      await tx.cashierShift.update({ where: { id: shift.id }, data: { cashRefundsMinor: { increment: cashRefundMinor }, expectedCashMinor: { decrement: cashRefundMinor } } });
    }
    await writeActivity({ ...actorAudit(actor), action: "REFUND_CREATED", entityType: "Refund", entityId: refund.id, deviceId: device.id, operationId: context.operationId, reason: input.reason, afterData: { invoiceId, amountMinor: input.amountMinor.toString(), cumulativeRefundedMinor: cumulative.toString() } }, tx);
    return refund;
  }, existingTx);
}

export function openShift(input: { id?: string; openingCashMinor: bigint }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    posAssert(input.openingCashMinor >= 0n, "INVALID_PAYMENT_TOTAL", "Opening cash cannot be negative");
    const current = await tx.cashierShift.findFirst({ where: { userId: actor.id, deviceId: device.id, status: "OPEN" } });
    posAssert(!current, "SHIFT_ALREADY_OPEN", "A shift is already open for this cashier and device");
    const shift = await tx.cashierShift.create({ data: { id: input.id, userId: actor.id, userNameSnapshot: actor.name, userRoleSnapshot: actor.role, deviceId: device.id, businessDate: await getBusinessDate(tx), openingCashMinor: input.openingCashMinor, expectedCashMinor: input.openingCashMinor } });
    await writeActivity({ ...actorAudit(actor), action: "SHIFT_OPENED", entityType: "CashierShift", entityId: shift.id, deviceId: device.id, operationId: context.operationId, afterData: { openingCashMinor: shift.openingCashMinor.toString() } }, tx);
    return shift;
  }, existingTx);
}

export function closeShift(shiftId: string, input: { actualClosingCashMinor: bigint }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    const shift = await tx.cashierShift.findUnique({ where: { id: shiftId } });
    posAssert(shift && shift.userId === actor.id && shift.deviceId === device.id && shift.status === "OPEN", "SHIFT_NOT_OPEN", "Open shift not found for this cashier/device");
    const reconciliation = reconcileShift(shift.openingCashMinor, shift.cashSalesMinor, shift.cashRefundsMinor, input.actualClosingCashMinor);
    const closed = await tx.cashierShift.update({ where: { id: shiftId }, data: { status: "CLOSED", expectedCashMinor: reconciliation.expectedCashMinor, actualClosingCashMinor: input.actualClosingCashMinor, differenceMinor: reconciliation.differenceMinor, closedAt: new Date() } });
    await writeActivity({ ...actorAudit(actor), action: "SHIFT_CLOSED", entityType: "CashierShift", entityId: shift.id, deviceId: device.id, operationId: context.operationId, beforeData: { status: shift.status }, afterData: { status: closed.status, expectedCashMinor: closed.expectedCashMinor.toString(), actualClosingCashMinor: input.actualClosingCashMinor.toString(), differenceMinor: reconciliation.differenceMinor!.toString() } }, tx);
    return closed;
  }, existingTx);
}

export interface ReservationInput {
  id?: string;
  customerName: string;
  phone: string;
  guestCount: number;
  startsAt: Date;
  endsAt?: Date | null;
  notes?: string | null;
  status?: ReservationStatus;
  tableIds?: string[];
}

async function validateReservationTables(tx: PosTx, tableIds: string[], startsAt: Date, endsAt: Date | null | undefined, excludeReservationId?: string) {
  const unique = [...new Set(tableIds)];
  const tables = await tx.diningTable.findMany({ where: { id: { in: unique }, isActive: true } });
  posAssert(tables.length === unique.length && tables.every((table) => table.status !== "DISABLED"), "TABLE_NOT_FOUND", "Reservation table is missing or disabled");
  const end = endsAt ?? new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const conflicts = await tx.reservationTable.findFirst({ where: { tableId: { in: unique }, reservationId: excludeReservationId ? { not: excludeReservationId } : undefined, reservation: { status: { in: ["PENDING", "CONFIRMED", "SEATED"] }, startsAt: { lt: end }, OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }] } } });
  posAssert(!conflicts, "TABLE_OCCUPIED", "A selected table has an overlapping reservation");
  return tables;
}

export function createReservation(input: ReservationInput, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    assertReservation({ startsAt: input.startsAt, endsAt: input.endsAt, guestCount: input.guestCount, version: 1 });
    const tables = await validateReservationTables(tx, input.tableIds ?? [], input.startsAt, input.endsAt);
    const reservation = await tx.reservation.create({ data: { id: input.id, customerName: input.customerName.trim(), phone: input.phone.trim(), guestCount: input.guestCount, startsAt: input.startsAt, endsAt: input.endsAt, notes: input.notes?.trim() || null, status: input.status ?? "PENDING", createdById: actor.id, createdByNameSnapshot: actor.name, createdByRoleSnapshot: actor.role, tables: { create: tables.map((table) => ({ tableId: table.id, tableCodeSnapshot: table.code, tableDisplayNameSnapshot: table.displayName })) } }, include: { tables: true } });
    await writeActivity({ ...actorAudit(actor), action: "RESERVATION_CREATED", entityType: "Reservation", entityId: reservation.id, deviceId: context.deviceId, operationId: context.operationId, afterData: { startsAt: reservation.startsAt.toISOString(), guestCount: reservation.guestCount, tableIds: tables.map((table) => table.id) } }, tx);
    return reservation;
  }, existingTx);
}

export function updateReservation(reservationId: string, expectedVersion: number, input: Partial<Omit<ReservationInput, "id">>, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor } = await loadContext(tx, context);
    const current = await tx.reservation.findUnique({ where: { id: reservationId }, include: { tables: true } });
    posAssert(current, "ORDER_NOT_FOUND", "Reservation not found");
    posAssert(current.version === expectedVersion, "VERSION_CONFLICT", "Reservation version conflict", { actualVersion: current.version });
    const startsAt = input.startsAt ?? current.startsAt;
    const endsAt = input.endsAt === undefined ? current.endsAt : input.endsAt;
    const guestCount = input.guestCount ?? current.guestCount;
    assertReservation({ startsAt, endsAt, guestCount, version: current.version });
    let tables: Awaited<ReturnType<typeof validateReservationTables>> | undefined;
    if (input.tableIds) tables = await validateReservationTables(tx, input.tableIds, startsAt, endsAt, reservationId);
    if (tables) {
      await tx.reservationTable.deleteMany({ where: { reservationId } });
      await tx.reservationTable.createMany({ data: tables.map((table) => ({ reservationId, tableId: table.id, tableCodeSnapshot: table.code, tableDisplayNameSnapshot: table.displayName })) });
    }
    const updated = await tx.reservation.update({ where: { id: reservationId }, data: { customerName: input.customerName?.trim(), phone: input.phone?.trim(), guestCount: input.guestCount, startsAt: input.startsAt, endsAt: input.endsAt, notes: input.notes === undefined ? undefined : input.notes?.trim() || null, status: input.status, version: { increment: 1 } }, include: { tables: true } });
    await writeActivity({ ...actorAudit(actor), action: updated.status === "CANCELLED" ? "RESERVATION_CANCELLED" : "RESERVATION_UPDATED", entityType: "Reservation", entityId: reservationId, deviceId: context.deviceId, operationId: context.operationId, beforeData: { status: current.status, version: current.version }, afterData: { status: updated.status, version: updated.version } }, tx);
    return updated;
  }, existingTx);
}

export function recordPrintEvent(invoiceId: string, input: { id?: string; type: "INITIAL" | "REPRINT"; paperWidthMm: 58 | 80; profileName?: string }, context: PosActorContext, existingTx?: PosTx) {
  return inTransaction(async (tx) => {
    const { actor, device } = await loadContext(tx, context);
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    posAssert(invoice, "INVOICE_NOT_FOUND", "Invoice not found");
    if (input.type === "REPRINT") posAssert(actor.role === "SUPER_ADMIN" || actor.role === "CASHIER", "DISCOUNT_NOT_ALLOWED", "Receipt reprint is not allowed");
    const event = await tx.receiptPrintEvent.create({ data: { id: input.id, invoiceId, deviceId: device.id, actorId: actor.id, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, type: input.type, paperWidthMm: input.paperWidthMm, profileName: input.profileName } });
    await writeActivity({ ...actorAudit(actor), action: input.type === "INITIAL" ? "INVOICE_PRINTED" : "INVOICE_REPRINTED", entityType: "Invoice", entityId: invoiceId, deviceId: device.id, operationId: context.operationId, afterData: { printEventId: event.id, paperWidthMm: event.paperWidthMm } }, tx);
    return event;
  }, existingTx);
}

export function getInvoice(invoiceId: string) {
  return prisma.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
}

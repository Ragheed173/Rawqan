import { Prisma, type AdminRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { writeActivity } from "../../lib/activityLog.js";
import { hashOperationRequest } from "../../domain/pos/operations.js";
import { PosDomainError, posAssert } from "../../domain/pos/errors.js";
import { toJsonSafe } from "../../utils/json.js";
import * as commands from "./pos.commands.js";
import * as schemas from "./pos.schemas.js";
import { ROLE_PERMISSIONS, roleHas, type Permission } from "../../config/permissions.js";

export interface PushOperation {
  operationId: string;
  localSequence: bigint;
  requestHash: string;
  operationType: string;
  payload: Record<string, unknown>;
  dependencies: string[];
}

export const SYNC_OPERATION_PERMISSIONS: Readonly<Partial<Record<string, Permission>>> = {
  APPLY_DISCOUNT: "pos:discount",
  VOID_INVOICE: "pos:void",
  REFUND_INVOICE: "pos:refund",
  CREATE_RESERVATION: "pos:reservation:manage",
  UPDATE_RESERVATION: "pos:reservation:manage",
  OPEN_SHIFT: "pos:shift:self",
  CLOSE_SHIFT: "pos:shift:self",
  PRINT_EVENT: "pos:receipt:reprint",
};

export function assertSyncOperationPermission(role: AdminRole, operationType: string) {
  const required = SYNC_OPERATION_PERMISSIONS[operationType];
  posAssert(!required || roleHas(role, required), "PERMISSION_DENIED", `Permission ${required} is required for ${operationType}`);
}

export function canRecoverMissingSyncDependencies(operationType: string) {
  return operationType === "CANCEL_ORDER";
}

function isLocalSequenceUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.map(String).join(",")
    : String(error.meta?.target ?? "");
  const normalized = target.toLowerCase().replaceAll("_", "");
  return normalized.includes("deviceid") && normalized.includes("localsequence");
}

async function localSequenceConflict(deviceId: string) {
  const latest = await prisma.syncOperation.aggregate({
    where: { deviceId },
    _max: { localSequence: true },
  });
  return new PosDomainError(
    "SYNC_SEQUENCE_CONFLICT",
    "The local operation sequence is already assigned to another operation",
    { nextLocalSequence: ((latest._max.localSequence ?? 0n) + 1n).toString() },
  );
}

function parseId(payload: Record<string, unknown>) {
  return schemas.uuid.parse(payload.id);
}

async function dispatch(operation: PushOperation, actorId: string, deviceId: string, tx: Prisma.TransactionClient) {
  const context = { actorId, deviceId, operationId: operation.operationId };
  const payload = operation.payload;
  switch (operation.operationType) {
    case "OPEN_ORDER": return commands.openOrder(schemas.openOrderBody.parse(payload), context, tx);
    case "UPDATE_ORDER": return commands.updateOrder(parseId(payload), schemas.orderPatchBody.parse(payload), context, tx);
    case "ADD_ORDER_ITEM": return commands.addOrderItem(schemas.uuid.parse(payload.orderId), schemas.addItemBody.parse(payload), context, tx);
    case "UPDATE_ORDER_ITEM": return commands.updateOrderItem(schemas.uuid.parse(payload.orderId), schemas.uuid.parse(payload.itemId), schemas.updateItemBody.parse(payload), context, tx);
    case "REMOVE_ORDER_ITEM": return commands.removeOrderItem(schemas.uuid.parse(payload.orderId), schemas.uuid.parse(payload.itemId), schemas.versionBody.parse(payload).expectedVersion, context, tx);
    case "REQUEST_BILL": return commands.requestBill(parseId(payload), schemas.versionBody.parse(payload).expectedVersion, context, tx);
    case "REOPEN_ORDER": return commands.reopenOrder(parseId(payload), schemas.versionBody.parse(payload).expectedVersion, context, tx);
    case "CANCEL_ORDER": return commands.cancelOrder(parseId(payload), schemas.versionBody.parse(payload).expectedVersion, context, tx);
    case "TRANSFER_ORDER": return commands.transferOrder(parseId(payload), schemas.transferBody.parse(payload), context, tx);
    case "MERGE_ORDERS": return commands.mergeOrders(parseId(payload), schemas.mergeBody.parse(payload), context, tx);
    case "APPLY_DISCOUNT": return commands.applyOrderDiscount(parseId(payload), schemas.discountBody.parse(payload), context, tx);
    case "FINALIZE_INVOICE": return commands.finalizeInvoice(schemas.finalizeBody.parse(payload), context, tx);
    case "FINALIZE_EQUAL_SPLIT": return commands.finalizeEqualSplit(schemas.equalSplitBody.parse(payload), context, tx);
    case "CREATE_PAYMENT": return commands.createPayment(schemas.uuid.parse(payload.invoiceId), schemas.paymentBody.parse(payload), context, tx);
    case "VOID_INVOICE": return commands.voidInvoice(schemas.uuid.parse(payload.invoiceId), schemas.voidBody.parse(payload), context, tx);
    case "REFUND_INVOICE": return commands.refundInvoice(schemas.uuid.parse(payload.invoiceId), schemas.refundBody.parse(payload), context, tx);
    case "OPEN_SHIFT": return commands.openShift(schemas.openShiftBody.parse(payload), context, tx);
    case "CLOSE_SHIFT": return commands.closeShift(parseId(payload), schemas.closeShiftBody.parse(payload), context, tx);
    case "CREATE_RESERVATION": return commands.createReservation(schemas.reservationBody.parse(payload), context, tx);
    case "UPDATE_RESERVATION": {
      const parsed = schemas.reservationPatchBody.parse(payload);
      const { expectedVersion, ...input } = parsed;
      return commands.updateReservation(parseId(payload), expectedVersion, input, context, tx);
    }
    case "PRINT_EVENT": return commands.recordPrintEvent(schemas.uuid.parse(payload.invoiceId), schemas.printBody.parse(payload), context, tx);
    default: throw new PosDomainError("SYNC_DEPENDENCY_MISSING", `Unsupported operation type ${operation.operationType}`);
  }
}

export async function pushOperations(actorId: string, deviceId: string, operations: PushOperation[]) {
  const [actor, device] = await Promise.all([
    prisma.admin.findUnique({ where: { id: actorId }, select: { role: true, isActive: true } }),
    prisma.posDevice.findUnique({ where: { id: deviceId }, select: { isActive: true } }),
  ]);
  posAssert(actor?.isActive && device?.isActive, "DEVICE_NOT_AUTHORIZED", "User or POS device is inactive");
  const sorted = [...operations].sort((a, b) => a.localSequence < b.localSequence ? -1 : a.localSequence > b.localSequence ? 1 : 0);
  posAssert(new Set(sorted.map((operation) => operation.operationId)).size === sorted.length, "SYNC_CONFLICT", "Duplicate operation IDs in push batch");
  const results: unknown[] = [];
  for (const operation of sorted) {
    assertSyncOperationPermission(actor.role, operation.operationType);
    const calculatedHash = hashOperationRequest({ operationType: operation.operationType, payload: operation.payload, dependencies: operation.dependencies });
    posAssert(calculatedHash === operation.requestHash, "SYNC_CONFLICT", "Operation request hash mismatch");
    const existing = await prisma.syncOperation.findUnique({ where: { operationId: operation.operationId } });
    if (existing) {
      posAssert(existing.deviceId === deviceId && existing.requestHash === operation.requestHash, "SYNC_CONFLICT", "Operation ID was already used with different content");
      if (existing.status === "SUCCEEDED") { results.push(existing.result); continue; }
      if (existing.status === "CONFLICT") throw new PosDomainError("SYNC_CONFLICT", existing.errorMessage ?? "Operation is conflicted");
    }
    const sequenceOwner = await prisma.syncOperation.findUnique({
      where: {
        deviceId_localSequence: {
          deviceId,
          localSequence: operation.localSequence,
        },
      },
      select: { operationId: true },
    });
    if (sequenceOwner && sequenceOwner.operationId !== operation.operationId) {
      throw await localSequenceConflict(deviceId);
    }
    const succeededDependencies = operation.dependencies.length ? await prisma.syncOperation.count({ where: { operationId: { in: operation.dependencies }, status: "SUCCEEDED" } }) : 0;
    // Cancellation is safe to validate from the persisted order itself. This
    // lets an old desktop queue recover when a historical sync-operation row
    // was pruned or lost, while the command still enforces exact version,
    // state, billing and table-assignment invariants transactionally.
    const canRecoverMissingDependencies = canRecoverMissingSyncDependencies(operation.operationType);
    posAssert(
      succeededDependencies === operation.dependencies.length || canRecoverMissingDependencies,
      "SYNC_DEPENDENCY_MISSING",
      "One or more operation dependencies have not succeeded",
    );
    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.syncOperation.upsert({ where: { operationId: operation.operationId }, create: { operationId: operation.operationId, deviceId, localSequence: operation.localSequence, requestHash: operation.requestHash, operationType: operation.operationType, status: "PROCESSING" }, update: { status: "PROCESSING", errorCode: null, errorMessage: null, processedAt: null } });
        const value = await dispatch(operation, actorId, deviceId, tx);
        const safe = toJsonSafe(value) as Prisma.InputJsonValue;
        await tx.syncOperation.update({ where: { operationId: operation.operationId }, data: { status: "SUCCEEDED", result: safe, processedAt: new Date() } });
        const actor = await tx.admin.findUniqueOrThrow({ where: { id: actorId }, select: { name: true, role: true } });
        await writeActivity({ adminId: actorId, actorNameSnapshot: actor.name, actorRoleSnapshot: actor.role, action: "POS_SYNC_APPLIED", entityType: "SyncOperation", entityId: operation.operationId, operationId: operation.operationId, deviceId, metadata: { operationType: operation.operationType, localSequence: operation.localSequence.toString() } }, tx);
        return safe;
      });
      results.push(result);
    } catch (error) {
      // The failed operation cannot be stored under a sequence already owned
      // by another operation. Return a recoverable, explicit error so the POS
      // can bootstrap the server cursor and safely rebase its local queue.
      if (isLocalSequenceUniqueConflict(error)) {
        throw await localSequenceConflict(deviceId);
      }
      const code = error instanceof PosDomainError ? error.code : "FAILED";
      const message = error instanceof Error ? error.message : "Sync operation failed";
      await prisma.syncOperation.upsert({ where: { operationId: operation.operationId }, create: { operationId: operation.operationId, deviceId, localSequence: operation.localSequence, requestHash: operation.requestHash, operationType: operation.operationType, status: code === "SYNC_CONFLICT" ? "CONFLICT" : "FAILED", errorCode: code, errorMessage: message, processedAt: new Date() }, update: { status: code === "SYNC_CONFLICT" ? "CONFLICT" : "FAILED", errorCode: code, errorMessage: message, processedAt: new Date() } });
      throw error;
    }
  }
  return results;
}

export async function pullChanges(actorId: string, deviceId: string, cursor: bigint, limit: number) {
  const [actor, device] = await Promise.all([
    prisma.admin.findUnique({ where: { id: actorId }, select: { role: true, isActive: true } }),
    prisma.posDevice.findUnique({ where: { id: deviceId }, select: { isActive: true } }),
  ]);
  posAssert(actor?.isActive && device?.isActive, "DEVICE_NOT_AUTHORIZED", "User or POS device is inactive");
  const changes = await prisma.catalogChange.findMany({ where: { revision: { gt: cursor } }, orderBy: { revision: "asc" }, take: limit });
  const nextCursor = changes.at(-1)?.revision ?? cursor;
  const [settings, tables, reservations, currentShift, categories, menuItems, modifierGroups, modifierLinks] = await Promise.all([
    prisma.restaurantSettings.findFirst({ select: { name: true, posCurrency: true, timezone: true, businessDayCutoff: true, posCacheEpoch: true, updatedAt: true } }),
    prisma.diningTable.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        orderAssignments: {
          where: { releasedAt: null },
          include: {
            order: {
              include: { items: { include: { modifiers: true } } },
            },
          },
        },
      },
    }),
    prisma.reservation.findMany({ where: { startsAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) }, status: { in: ["PENDING", "CONFIRMED", "SEATED"] } }, include: { tables: true }, orderBy: { startsAt: "asc" }, take: 200 }),
    prisma.cashierShift.findFirst({ where: { userId: actorId, deviceId, status: "OPEN" } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.menuItem.findMany({ where: { isArchived: false }, orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }], include: { images: { orderBy: { sortOrder: "asc" } }, tags: { include: { tag: true } } } }),
    prisma.modifierGroup.findMany({ include: { options: { orderBy: { sortOrder: "asc" } } }, orderBy: { sortOrder: "asc" } }),
    prisma.menuItemModifierGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return { cursor: nextCursor, hasMore: changes.length === limit, changes, configuration: { settings, tables, reservations, currentShift, permissions: ROLE_PERMISSIONS[actor.role], catalog: { revision: nextCursor, categories, menuItems, modifierGroups, menuItemModifierGroups: modifierLinks } } };
}

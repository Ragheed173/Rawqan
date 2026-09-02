import {
  api,
  isPosCloudAuthenticationRequired,
  requirePosCloudAuthentication,
  unwrap,
} from "@/lib/apiClient";
import {
  posDb,
  type LocalCategory,
  type LocalMenuItem,
  type LocalModifierGroup,
  type LocalModifierOption,
  type LocalTable,
} from "../db/schema";
import type { SyncOperation } from "../types";
import type {
  LocalOrder,
  LocalOrderItem,
  LocalOrderModifier,
  LocalOrderTable,
} from "../types";
import { config } from "@/config/env";
import { posErrorCode, posErrorMessage } from "../errors";
import { scheduleDesktopBackup } from "../db/backup";

let running: Promise<void> | null = null;
export function syncNow(options: { retryFailed?: boolean } = {}) {
  running ??= withCrossTabLock(() => runSync(options)).finally(() => {
    running = null;
  });
  return running;
}

async function withCrossTabLock(work: () => Promise<void>) {
  if (navigator.locks)
    return navigator.locks.request(
      "rawaqan-pos-sync",
      { mode: "exclusive" },
      work,
    );
  return work();
}

interface RunSyncOptions {
  retryFailed?: boolean;
  sequenceRecoveryAttempted?: boolean;
}

async function runSync(options: RunSyncOptions = {}) {
  const state = await posDb.deviceState.get("primary");
  if (!state) return;
  if (isPosCloudAuthenticationRequired()) {
    await pauseUnauthorizedOperations();
    requirePosCloudAuthentication();
    throw Object.assign(new Error("UNAUTHORIZED"), { code: "UNAUTHORIZED" });
  }
  // The exclusive browser lock means any rows left in SYNCING came from an
  // interrupted tab/process. Requeue them before selecting due work.
  await recoverInterruptedOperations();
  if (options.retryFailed) {
    await posDb.syncOperations
      .where("status")
      .equals("FAILED")
      .modify({ nextAttemptAt: new Date().toISOString() });
  }
  const due = await posDb.syncOperations
    .where("status")
    .anyOf("PENDING", "FAILED")
    .filter((operation) => {
      if (!options.retryFailed && operation.errorCode === "UNAUTHORIZED")
        return false;
      return (
        !operation.nextAttemptAt ||
        operation.nextAttemptAt <= new Date().toISOString()
      );
    })
    .sortBy("createdAt");
  for (const operation of orderDueOperations(due)) {
    await posDb.syncOperations.update(operation.operationId, {
      status: "SYNCING",
      attempts: operation.attempts + 1,
    });
    try {
      const results = await unwrap<unknown[]>(
        api.post(
          "/pos/sync/push",
          { deviceId: state.deviceId, operations: [wire(operation)] },
          { headers: { "x-pos-device-id": state.deviceId } },
        ),
      );
      await reconcilePushResult(operation, results[0]);
      await posDb.syncOperations.update(operation.operationId, {
        status: "SUCCEEDED",
        processedAt: new Date().toISOString(),
        errorCode: undefined,
        errorMessage: undefined,
      });
    } catch (error) {
      const attempts = operation.attempts + 1;
      const delay = Math.min(300_000, 1000 * 2 ** Math.min(attempts, 8));
      const code = posErrorCode(error) ?? "BACKEND_UNAVAILABLE";
      if (
        code === "SYNC_SEQUENCE_CONFLICT" &&
        !options.sequenceRecoveryAttempted
      ) {
        const bootstrap = await unwrap<Parameters<typeof applyBootstrap>[0]>(
          api.get(`/pos/bootstrap?deviceId=${state.deviceId}`, {
            headers: { "x-pos-device-id": state.deviceId },
          }),
        );
        await applyBootstrap(bootstrap);
        return runSync({
          retryFailed: true,
          sequenceRecoveryAttempted: true,
        });
      }
      const conflict =
        code === "SYNC_CONFLICT" ||
        code === "VERSION_CONFLICT" ||
        code === "CONFLICT";
      if (code === "UNAUTHORIZED") {
        requirePosCloudAuthentication();
        await posDb.syncOperations.update(operation.operationId, {
          status: "PENDING",
          nextAttemptAt: undefined,
          errorCode: "UNAUTHORIZED",
          errorMessage: posErrorMessage(error),
        });
        await pauseUnauthorizedOperations();
        throw error;
      }
      await posDb.syncOperations.update(operation.operationId, {
        status: conflict ? "CONFLICT" : "FAILED",
        nextAttemptAt: conflict
          ? undefined
          : new Date(Date.now() + delay).toISOString(),
        errorCode: code,
        errorMessage: posErrorMessage(error),
      });
      throw error;
    }
  }
  const pull = await unwrap<PullResponse>(
    api.get(`/pos/sync/pull?cursor=${state.catalogRevision}`, {
      headers: { "x-pos-device-id": state.deviceId },
    }),
  );
  await applyPulledCatalog(pull.configuration.catalog);
  await applyPulledOperations(pull.configuration);
  await posDb.deviceState.update("primary", {
    catalogRevision: pull.cursor,
    lastSuccessfulSync: new Date().toISOString(),
    timezone: pull.configuration.settings?.timezone,
    businessDayCutoff: pull.configuration.settings?.businessDayCutoff,
    restaurantName: pull.configuration.settings?.name,
  });
  scheduleDesktopBackup("cloud-sync");
}

export async function pauseUnauthorizedOperations() {
  await posDb.syncOperations
    .where("status")
    .equals("FAILED")
    .filter((operation) => operation.errorCode === "UNAUTHORIZED")
    .modify({
      status: "PENDING",
      nextAttemptAt: undefined,
    });
}

interface InvoiceIdentity {
  id: string;
  invoiceNumber: string;
}

function invoiceIdentities(
  operation: SyncOperation,
  result: unknown,
): InvoiceIdentity[] {
  if (!result || typeof result !== "object") return [];
  const record = result as Record<string, unknown>;
  const candidates =
    operation.operationType === "FINALIZE_EQUAL_SPLIT" &&
    Array.isArray(record.invoices)
      ? record.invoices
      : operation.operationType === "FINALIZE_INVOICE"
        ? [record]
        : [];
  return candidates.filter((candidate): candidate is InvoiceIdentity => {
    if (!candidate || typeof candidate !== "object") return false;
    const invoice = candidate as Record<string, unknown>;
    return typeof invoice.id === "string" && typeof invoice.invoiceNumber === "string";
  });
}

/**
 * Reconciles a locally reserved invoice number with the canonical number
 * returned by the server. Staging both sides avoids violating IndexedDB's
 * unique invoice-number index when two browser contexts reserved the same
 * sequence.
 */
export async function reconcilePushResult(
  operation: SyncOperation,
  result: unknown,
) {
  const identities = invoiceIdentities(operation, result);
  if (!identities.length) return;

  await posDb.transaction("rw", posDb.invoices, async () => {
    for (const invoice of identities) {
      if (await posDb.invoices.get(invoice.id)) {
        await posDb.invoices.update(invoice.id, {
          invoiceNumber: `LOCAL-PENDING-${invoice.id}`,
        });
      }
    }
    for (const invoice of identities) {
      const occupied = await posDb.invoices
        .where("invoiceNumber")
        .equals(invoice.invoiceNumber)
        .first();
      if (occupied && occupied.id !== invoice.id) {
        await posDb.invoices.update(occupied.id, {
          invoiceNumber: `LOCAL-PENDING-${occupied.id}`,
        });
      }
      if (await posDb.invoices.get(invoice.id)) {
        await posDb.invoices.update(invoice.id, {
          invoiceNumber: invoice.invoiceNumber,
        });
      }
    }
  });
}

export function orderDueOperations(operations: SyncOperation[]) {
  const ordered = [...operations].sort((a, b) =>
    BigInt(a.localSequence) < BigInt(b.localSequence) ? -1 : 1,
  );
  const blockedPaymentIndex = ordered.findIndex(
    (operation) => operation.errorCode === "SHIFT_REQUIRED",
  );
  const pendingOpenShiftIndex = ordered.findIndex(
    (operation, index) =>
      index > blockedPaymentIndex && operation.operationType === "OPEN_SHIFT",
  );
  const hasInterveningClose = ordered.some(
    (operation, index) =>
      index > blockedPaymentIndex &&
      index < pendingOpenShiftIndex &&
      operation.operationType === "CLOSE_SHIFT",
  );
  if (
    blockedPaymentIndex >= 0 &&
    pendingOpenShiftIndex > blockedPaymentIndex &&
    !hasInterveningClose
  ) {
    const [openShift] = ordered.splice(pendingOpenShiftIndex, 1);
    ordered.splice(blockedPaymentIndex, 0, openShift!);
  }
  return ordered;
}

export async function recoverInterruptedOperations() {
  await posDb.syncOperations
    .where("status")
    .equals("SYNCING")
    .modify({
      status: "FAILED",
      nextAttemptAt: new Date().toISOString(),
      errorCode: "SYNC_INTERRUPTED",
      errorMessage: "Previous sync was interrupted and safely requeued",
    });
}

function wire(operation: SyncOperation) {
  return {
    operationId: operation.operationId,
    localSequence: operation.localSequence,
    requestHash: operation.requestHash,
    operationType: operation.operationType,
    payload: operation.payload,
    dependencies: operation.dependencies,
  };
}

export function startSyncTriggers() {
  const trigger = () => {
    if (document.visibilityState === "visible") void healthAndSync();
  };
  window.addEventListener("online", trigger);
  document.addEventListener("visibilitychange", trigger);
  const interval = window.setInterval(trigger, 30_000);
  trigger();
  return () => {
    window.removeEventListener("online", trigger);
    document.removeEventListener("visibilitychange", trigger);
    clearInterval(interval);
  };
}

export async function checkBackendHealth() {
  try {
    const apiUrl = new URL(config.apiBaseUrl, location.origin);
    apiUrl.pathname = apiUrl.pathname.replace(/\/api\/?$/, "/health");
    const response = await fetch(apiUrl, {
      cache: "no-store",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function healthAndSync() {
  const healthy = await checkBackendHealth();
  window.dispatchEvent(
    new CustomEvent("rawaqan-pos-connectivity", { detail: healthy }),
  );
  if (!healthy) return;
  try {
    await syncNow();
  } catch {
    const stillHealthy = await checkBackendHealth();
    window.dispatchEvent(
      new CustomEvent("rawaqan-pos-connectivity", { detail: stillHealthy }),
    );
    /* A rejected operation stays in the durable outbox for diagnostics. */
  }
}

function decimalToMinor(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * 100n +
    BigInt(fraction.padEnd(2, "0").slice(0, 2))
  ).toString();
}

interface WireCatalog {
  revision: string;
  categories: LocalCategory[];
  menuItems: (Omit<LocalMenuItem, "priceMinor" | "discountPriceMinor"> & {
    price: string;
    discountPrice?: string | null;
  })[];
  modifierGroups: (LocalModifierGroup & {
    options: (Omit<LocalModifierOption, "priceMinor"> & { price: string })[];
  })[];
  menuItemModifierGroups: {
    id: string;
    menuItemId: string;
    groupId: string;
    sortOrder: number;
  }[];
}

interface WireOrderItem extends LocalOrderItem {
  modifiers?: LocalOrderModifier[];
}

interface WireOrder extends LocalOrder {
  items?: WireOrderItem[];
}

interface WireOrderAssignment extends LocalOrderTable {
  order?: WireOrder;
}

interface WireTable extends LocalTable {
  orderAssignments?: WireOrderAssignment[];
}

interface PullResponse {
  cursor: string;
  changes: unknown[];
  configuration: {
    settings?: {
      name?: string;
      timezone?: string;
      businessDayCutoff?: string;
      posCacheEpoch?: number;
    };
    catalog: WireCatalog;
    tables?: WireTable[];
    reservations?: {
      id: string;
      customerName: string;
      phone: string;
      guestCount: number;
      startsAt: string;
      endsAt?: string | null;
      notes?: string | null;
      status: string;
      version: number;
      tables?: { tableId: string }[];
    }[];
    currentShift?: ({ id: string } & Record<string, unknown>) | null;
  };
}

async function applyPulledCatalog(catalog: WireCatalog) {
  await posDb.transaction(
    "rw",
    [
      posDb.catalogMeta,
      posDb.categories,
      posDb.menuItems,
      posDb.modifierGroups,
      posDb.modifierOptions,
      posDb.menuItemModifierGroups,
    ],
    async () => {
      await Promise.all([
        posDb.categories.clear(),
        posDb.menuItems.clear(),
        posDb.modifierGroups.clear(),
        posDb.modifierOptions.clear(),
        posDb.menuItemModifierGroups.clear(),
      ]);
      await posDb.categories.bulkPut(catalog.categories);
      await posDb.menuItems.bulkPut(
        catalog.menuItems.map((item) => ({
          ...item,
          priceMinor: decimalToMinor(item.price),
          discountPriceMinor: item.discountPrice
            ? decimalToMinor(item.discountPrice)
            : null,
        })),
      );
      await posDb.modifierGroups.bulkPut(
        catalog.modifierGroups.map(({ options: _options, ...group }) => group),
      );
      await posDb.modifierOptions.bulkPut(
        catalog.modifierGroups.flatMap((group) =>
          group.options.map((option) => ({
            ...option,
            priceMinor: decimalToMinor(option.price),
          })),
        ),
      );
      await posDb.menuItemModifierGroups.bulkPut(
        catalog.menuItemModifierGroups,
      );
      await posDb.catalogMeta.put({
        key: "catalog",
        revision: catalog.revision,
        updatedAt: new Date().toISOString(),
      });
    },
  );
}

async function applyPulledOperations(
  configuration: PullResponse["configuration"],
) {
  await applyServerPosCacheEpoch(configuration.settings?.posCacheEpoch);
  await posDb.transaction(
    "rw",
    [
      posDb.restaurantTables,
      posDb.orders,
      posDb.orderTables,
      posDb.orderItems,
      posDb.orderItemModifiers,
      posDb.reservations,
      posDb.shifts,
      posDb.syncOperations,
    ],
    async () => {
      if (configuration.tables) {
        await posDb.restaurantTables.clear();
        await posDb.restaurantTables.bulkPut(
          configuration.tables.map((table) => ({
            ...table,
            currentOrderId: table.orderAssignments?.[0]?.orderId ?? null,
          })),
        );
        await reconcileActiveOrders(configuration.tables);
      }
      if (configuration.reservations) {
        await posDb.reservations.clear();
        await posDb.reservations.bulkPut(
          configuration.reservations.map((reservation) => ({
            ...reservation,
            tableIds: reservation.tables?.map((table) => table.tableId) ?? [],
          })),
        );
      }
      await reconcileCurrentShift(configuration.currentShift);
    },
  );
}

/**
 * Applies an explicit server-side transactional reset once per browser.
 * Unfinished offline work always wins: the reset is deferred and the epoch is
 * left unchanged so a later successful sync can safely retry it.
 */
export async function applyServerPosCacheEpoch(serverEpoch?: number) {
  if (!Number.isSafeInteger(serverEpoch) || serverEpoch! < 0) return false;
  const current = await posDb.deviceState.get("primary");
  if (!current) return true;
  if ((current.posCacheEpoch ?? 0) >= serverEpoch!) return true;

  const unfinished = await posDb.syncOperations
    .where("status")
    .anyOf("PENDING", "SYNCING", "FAILED", "CONFLICT")
    .count();
  if (unfinished > 0) return false;

  await posDb.transaction(
    "rw",
    [
      posDb.orders,
      posDb.orderTables,
      posDb.orderItems,
      posDb.orderItemModifiers,
      posDb.invoices,
      posDb.invoiceLines,
      posDb.invoiceModifiers,
      posDb.invoiceAllocationLines,
      posDb.invoiceAllocationModifiers,
      posDb.discounts,
      posDb.payments,
      posDb.refunds,
      posDb.receiptPrintEvents,
      posDb.reservations,
      posDb.shifts,
      posDb.syncOperations,
      posDb.deviceState,
    ],
    async () => {
      await Promise.all([
        posDb.orders.clear(),
        posDb.orderTables.clear(),
        posDb.orderItems.clear(),
        posDb.orderItemModifiers.clear(),
        posDb.invoices.clear(),
        posDb.invoiceLines.clear(),
        posDb.invoiceModifiers.clear(),
        posDb.invoiceAllocationLines.clear(),
        posDb.invoiceAllocationModifiers.clear(),
        posDb.discounts.clear(),
        posDb.payments.clear(),
        posDb.refunds.clear(),
        posDb.receiptPrintEvents.clear(),
        posDb.reservations.clear(),
        posDb.shifts.clear(),
        posDb.syncOperations.clear(),
      ]);
      await posDb.deviceState.update("primary", {
        posCacheEpoch: serverEpoch,
      });
    },
  );
  return true;
}

async function reconcileActiveOrders(tables: WireTable[]) {
  const assignments = tables.flatMap(
    (table) => table.orderAssignments ?? [],
  );
  const snapshots = assignments.filter(
    (assignment): assignment is WireOrderAssignment & { order: WireOrder } =>
      Boolean(assignment.order),
  );
  if (!snapshots.length) return;

  const unfinished = await posDb.syncOperations
    .where("status")
    .anyOf("PENDING", "SYNCING", "FAILED", "CONFLICT")
    .toArray();

  for (const assignment of snapshots) {
    const order = assignment.order;
    const hasLocalChanges = unfinished.some(
      (operation) =>
        operation.payload.id === order.id ||
        operation.payload.orderId === order.id ||
        (Array.isArray(operation.payload.sourceOrderIds) &&
          operation.payload.sourceOrderIds.includes(order.id)),
    );
    if (hasLocalChanges) continue;

    const existingItems = await posDb.orderItems
      .where("orderId")
      .equals(order.id)
      .toArray();
    const existingItemIds = existingItems.map((item) => item.id);
    if (existingItemIds.length) {
      await posDb.orderItemModifiers
        .where("orderItemId")
        .anyOf(existingItemIds)
        .delete();
    }
    await posDb.orderItems.where("orderId").equals(order.id).delete();

    const { items = [], ...localOrder } = order;
    await posDb.orders.put(localOrder);
    await posDb.orderTables.put({
      id: assignment.id,
      orderId: assignment.orderId,
      tableId: assignment.tableId,
      assignedAt: assignment.assignedAt,
      releasedAt: assignment.releasedAt,
      isPrimary: assignment.isPrimary,
    });
    if (items.length) {
      await posDb.orderItems.bulkPut(
        items.map(({ modifiers: _modifiers, ...item }) => item),
      );
      const modifiers = items.flatMap((item) => item.modifiers ?? []);
      if (modifiers.length) await posDb.orderItemModifiers.bulkPut(modifiers);
    }
  }
}

export async function reconcileCurrentShift(
  currentShift: ({ id: string } & Record<string, unknown>) | null | undefined,
) {
  const openShifts = await posDb.shifts
    .where("status")
    .equals("OPEN")
    .toArray();
  if (currentShift) {
    const staleIds = openShifts
      .filter((shift) => shift.id !== currentShift.id)
      .map((shift) => shift.id);
    if (staleIds.length) await posDb.shifts.bulkDelete(staleIds);
    await posDb.shifts.put(currentShift);
    return;
  }

  const unsyncedOpenShiftIds = new Set(
    (
      await posDb.syncOperations
        .where("status")
        .anyOf("PENDING", "SYNCING", "FAILED")
        .filter(
          (operation) =>
            operation.operationType === "OPEN_SHIFT" &&
            operation.errorCode !== "SHIFT_ALREADY_OPEN" &&
            operation.errorCode !== "PERMISSION_DENIED" &&
            operation.errorCode !== "DEVICE_NOT_AUTHORIZED",
        )
        .toArray()
    )
      .map((operation) => operation.payload.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const staleIds = openShifts
    .filter((shift) => !unsyncedOpenShiftIds.has(shift.id))
    .map((shift) => shift.id);
  if (staleIds.length) await posDb.shifts.bulkDelete(staleIds);
}

export async function reconcileLocalSequence(
  deviceId: string,
  serverNextLocalSequence: string,
) {
  const current = await posDb.deviceState.get("primary");
  const remoteNext = BigInt(serverNextLocalSequence);
  const localNext = BigInt(current?.nextLocalSequence ?? "1");
  const unfinished = (
    await posDb.syncOperations
      .where("status")
      .anyOf("PENDING", "SYNCING", "FAILED")
      .filter((operation) => operation.deviceId === deviceId)
      .toArray()
  ).sort((a, b) =>
    BigInt(a.localSequence) < BigInt(b.localSequence) ? -1 : 1,
  );
  const highestUnfinished = unfinished.reduce(
    (highest, operation) => {
      const sequence = BigInt(operation.localSequence);
      return sequence > highest ? sequence : highest;
    },
    0n,
  );
  const needsRebase = unfinished.some(
    (operation) => BigInt(operation.localSequence) < remoteNext,
  );
  let next = [remoteNext, localNext, highestUnfinished + 1n].reduce(
    (highest, value) => (value > highest ? value : highest),
  );

  if (needsRebase) {
    const retryAt = new Date().toISOString();
    for (const operation of unfinished) {
      await posDb.syncOperations.update(operation.operationId, {
        localSequence: next.toString(),
        status: "PENDING",
        nextAttemptAt: retryAt,
        errorCode: undefined,
        errorMessage: undefined,
      });
      next += 1n;
    }
  }

  return next.toString();
}

export async function applyBootstrap(data: {
  device: { id: string; code: string };
  nextLocalSequence?: string;
  settings?: {
    name?: string;
    footerText?: string | null;
    timezone?: string;
    businessDayCutoff?: string;
    posCacheEpoch?: number;
  };
  currentShift?: ({ id: string } & Record<string, unknown>) | null;
  reservations?: {
    id: string;
    customerName: string;
    phone: string;
    guestCount: number;
    startsAt: string;
    endsAt?: string | null;
    notes?: string | null;
    status: string;
    version: number;
    tableIds?: string[];
    tables?: { tableId: string }[];
  }[];
  catalog: {
    revision: string;
    categories: LocalCategory[];
    menuItems: (Omit<LocalMenuItem, "priceMinor" | "discountPriceMinor"> & {
      price: string;
      discountPrice?: string | null;
    })[];
    modifierGroups: (LocalModifierGroup & {
      options: (Omit<LocalModifierOption, "priceMinor"> & { price: string })[];
    })[];
    menuItemModifierGroups: {
      id: string;
      menuItemId: string;
      groupId: string;
      sortOrder: number;
    }[];
  };
  tables: WireTable[];
}) {
  const cacheResetApplied = await applyServerPosCacheEpoch(
    data.settings?.posCacheEpoch,
  );
  await posDb.transaction(
    "rw",
    [
      posDb.catalogMeta,
      posDb.categories,
      posDb.menuItems,
      posDb.modifierGroups,
      posDb.modifierOptions,
      posDb.menuItemModifierGroups,
      posDb.restaurantTables,
      posDb.orders,
      posDb.orderTables,
      posDb.orderItems,
      posDb.orderItemModifiers,
      posDb.reservations,
      posDb.shifts,
      posDb.syncOperations,
      posDb.deviceState,
    ],
    async () => {
      await Promise.all([
        posDb.categories.clear(),
        posDb.menuItems.clear(),
        posDb.modifierGroups.clear(),
        posDb.modifierOptions.clear(),
        posDb.menuItemModifierGroups.clear(),
        posDb.restaurantTables.clear(),
        posDb.reservations.clear(),
      ]);
      await posDb.categories.bulkPut(data.catalog.categories);
      await posDb.menuItems.bulkPut(
        data.catalog.menuItems.map((item) => ({
          ...item,
          priceMinor: decimalToMinor(item.price),
          discountPriceMinor: item.discountPrice
            ? decimalToMinor(item.discountPrice)
            : null,
        })),
      );
      await posDb.modifierGroups.bulkPut(
        data.catalog.modifierGroups.map(
          ({ options: _options, ...group }) => group,
        ),
      );
      await posDb.modifierOptions.bulkPut(
        data.catalog.modifierGroups.flatMap((group) =>
          group.options.map((option) => ({
            ...option,
            priceMinor: decimalToMinor(option.price),
          })),
        ),
      );
      await posDb.menuItemModifierGroups.bulkPut(
        data.catalog.menuItemModifierGroups,
      );
      await posDb.restaurantTables.bulkPut(
        data.tables.map((table) => ({
          ...table,
          currentOrderId:
            (table as LocalTable & { orderAssignments?: { orderId: string }[] })
              .orderAssignments?.[0]?.orderId ?? table.currentOrderId,
        })),
      );
      await reconcileActiveOrders(data.tables);
      if (data.reservations?.length)
        await posDb.reservations.bulkPut(
          data.reservations.map((reservation) => ({
            id: reservation.id,
            customerName: reservation.customerName,
            phone: reservation.phone,
            guestCount: reservation.guestCount,
            startsAt: reservation.startsAt,
            endsAt: reservation.endsAt,
            notes: reservation.notes,
            status: reservation.status,
            version: reservation.version,
            tableIds:
              reservation.tableIds ??
              reservation.tables?.map((table) => table.tableId) ??
              [],
          })),
        );
      await reconcileCurrentShift(data.currentShift);
      const current = await posDb.deviceState.get("primary");
      const nextLocalSequence = data.nextLocalSequence
        ? await reconcileLocalSequence(data.device.id, data.nextLocalSequence)
        : current?.nextLocalSequence ?? "1";
      await posDb.deviceState.put({
        key: "primary",
        deviceId: data.device.id,
        deviceCode: data.device.code,
        nextLocalSequence,
        invoiceYear: current?.invoiceYear ?? new Date().getFullYear(),
        nextInvoiceSequence: current?.nextInvoiceSequence ?? 1,
        catalogRevision: data.catalog.revision,
        lastSuccessfulSync: new Date().toISOString(),
        timezone: data.settings?.timezone ?? current?.timezone,
        businessDayCutoff:
          data.settings?.businessDayCutoff ?? current?.businessDayCutoff,
        restaurantName: data.settings?.name ?? current?.restaurantName,
        receiptFooter: data.settings?.footerText ?? current?.receiptFooter,
        posCacheEpoch: cacheResetApplied
          ? data.settings?.posCacheEpoch ?? current?.posCacheEpoch
          : current?.posCacheEpoch,
      });
    },
  );
  scheduleDesktopBackup("bootstrap");
}

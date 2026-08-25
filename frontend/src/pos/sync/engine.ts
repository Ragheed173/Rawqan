import { api, unwrap } from "@/lib/apiClient";
import {
  posDb,
  type LocalCategory,
  type LocalMenuItem,
  type LocalModifierGroup,
  type LocalModifierOption,
  type LocalTable,
} from "../db/schema";
import type { SyncOperation } from "../types";
import { config } from "@/config/env";
import { posErrorCode, posErrorMessage } from "../errors";

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

async function runSync(options: { retryFailed?: boolean } = {}) {
  const state = await posDb.deviceState.get("primary");
  if (!state) return;
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
    .filter(
      (operation) =>
        !operation.nextAttemptAt ||
        operation.nextAttemptAt <= new Date().toISOString(),
    )
    .sortBy("createdAt");
  for (const operation of orderDueOperations(due)) {
    await posDb.syncOperations.update(operation.operationId, {
      status: "SYNCING",
      attempts: operation.attempts + 1,
    });
    try {
      await unwrap(
        api.post(
          "/pos/sync/push",
          { deviceId: state.deviceId, operations: [wire(operation)] },
          { headers: { "x-pos-device-id": state.deviceId } },
        ),
      );
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
      const conflict = code === "SYNC_CONFLICT" || code === "VERSION_CONFLICT";
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
interface PullResponse {
  cursor: string;
  changes: unknown[];
  configuration: {
    settings?: { name?: string; timezone?: string; businessDayCutoff?: string };
    catalog: WireCatalog;
    tables?: (LocalTable & { orderAssignments?: { orderId: string }[] })[];
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
  await posDb.transaction(
    "rw",
    [
      posDb.restaurantTables,
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
  tables: LocalTable[];
}) {
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
      });
    },
  );
}

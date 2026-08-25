import type { Table } from "dexie";
import { posDb, type LocalReservation } from "../db/schema";
import { requestHash } from "../sync/hash";
import { addMinor, allocateMinorLinesToTargets, multiplyMinor, splitMinorEqual, type LocalInvoice, type LocalInvoiceAllocationLine, type LocalOrderItem, type LocalPayment, type SyncOperation } from "../types";

async function localOperation<T>(operationType: string, payload: Record<string, unknown>, tables: Table[], mutate: () => Promise<T>, dependencies: string[] = []) {
  const operationId = crypto.randomUUID();
  const hash = await requestHash(operationType, payload, dependencies);
  return posDb.transaction("rw", [...tables, posDb.syncOperations, posDb.deviceState], async () => {
    const state = await posDb.deviceState.get("primary");
    if (!state) throw new Error("DEVICE_NOT_PAIRED");
    const sequence = BigInt(state.nextLocalSequence);
    const result = await mutate();
    const operation: SyncOperation = { operationId, deviceId: state.deviceId, localSequence: sequence.toString(), requestHash: hash, operationType, payload, dependencies, status: "PENDING", attempts: 0, createdAt: new Date().toISOString() };
    await posDb.syncOperations.add(operation);
    await posDb.deviceState.update("primary", { nextLocalSequence: (sequence + 1n).toString() });
    return { result, operation };
  });
}

export async function openLocalOrder(input: { tableId: string; userId: string; businessDate: string; guestCount?: number; notes?: string }) {
  const id = crypto.randomUUID(); const assignedId = crypto.randomUUID(); const now = new Date().toISOString();
  const state = await posDb.deviceState.get("primary"); if (!state) throw new Error("DEVICE_NOT_PAIRED");
  const payload = { id, tableId: input.tableId, guestCount: input.guestCount, notes: input.notes };
  return localOperation("OPEN_ORDER", payload, [posDb.orders, posDb.orderTables, posDb.restaurantTables], async () => {
    const table = await posDb.restaurantTables.get(input.tableId); if (!table || !table.isActive || table.status === "DISABLED") throw new Error("TABLE_DISABLED"); if (table.currentOrderId) throw new Error("TABLE_OCCUPIED");
    await posDb.orders.add({ id, status: "OPEN", version: 1, businessDate: input.businessDate, deviceId: state.deviceId, openedById: input.userId, openedAt: now, guestCount: input.guestCount, notes: input.notes });
    await posDb.orderTables.add({ id: assignedId, orderId: id, tableId: input.tableId, assignedAt: now, isPrimary: true });
    await posDb.restaurantTables.update(input.tableId, { status: "OCCUPIED", currentOrderId: id }); return id;
  });
}

export async function addLocalOrderItem(input: Omit<LocalOrderItem, "id" | "lineTotalMinor" | "sortOrder"> & { modifiers?: { id: string; groupNameSnapshot: string; optionNameSnapshot: string; priceTypeSnapshot: "DELTA" | "REPLACEMENT"; unitPriceMinor: string }[] }) {
  const id = crypto.randomUUID(); const order = await posDb.orders.get(input.orderId); if (!order) throw new Error("ORDER_NOT_FOUND");
  const payload = { id, orderId: input.orderId, expectedVersion: order.version, menuItemId: input.menuItemId, quantity: input.quantity, notes: input.notes, modifierOptionIds: input.modifiers?.map((modifier) => modifier.id) ?? [] };
  return localOperation("ADD_ORDER_ITEM", payload, [posDb.orders, posDb.orderItems, posDb.orderItemModifiers], async () => {
    const current = await posDb.orders.get(input.orderId); if (!current || current.status !== "OPEN") throw new Error("ORDER_NOT_OPEN");
    const item: LocalOrderItem = { ...input, id, lineTotalMinor: multiplyMinor(input.unitPriceMinor, input.quantity), sortOrder: await posDb.orderItems.where("orderId").equals(input.orderId).count() };
    await posDb.orderItems.add(item);
    if (input.modifiers?.length) await posDb.orderItemModifiers.bulkAdd(input.modifiers.map((modifier) => ({ ...modifier, id: crypto.randomUUID(), orderItemId: id, modifierOptionId: modifier.id, unitPriceMinor: modifier.unitPriceMinor, quantity: 1, lineTotalMinor: modifier.unitPriceMinor })));
    await posDb.orders.update(input.orderId, { version: current.version + 1 }); return item;
  });
}

export async function requestLocalBill(orderId: string) {
  const order = await posDb.orders.get(orderId); if (!order) throw new Error("ORDER_NOT_FOUND");
  const payload = { id: orderId, expectedVersion: order.version };
  return localOperation("REQUEST_BILL", payload, [posDb.orders, posDb.orderTables, posDb.restaurantTables], async () => {
    await posDb.orders.update(orderId, { status: "BILL_REQUESTED", version: order.version + 1 });
    const assignments = await posDb.orderTables.where("orderId").equals(orderId).filter((row) => !row.releasedAt).toArray();
    await Promise.all(assignments.map((row) => posDb.restaurantTables.update(row.tableId, { status: "BILL_REQUESTED" }))); return orderId;
  });
}

export async function updateLocalOrderItem(orderId: string, itemId: string, quantity: number, notes?: string | null) {
  const order = await posDb.orders.get(orderId); const item = await posDb.orderItems.get(itemId); if (!order || !item) throw new Error("ORDER_NOT_FOUND");
  const payload = { orderId, itemId, expectedVersion: order.version, quantity, notes };
  return localOperation("UPDATE_ORDER_ITEM", payload, [posDb.orders, posDb.orderItems], async () => { if (quantity <= 0 || !Number.isInteger(quantity)) throw new Error("INVALID_QUANTITY"); await posDb.orderItems.update(itemId, { quantity, notes, lineTotalMinor: multiplyMinor(item.unitPriceMinor, quantity) }); await posDb.orders.update(orderId, { version: order.version + 1 }); return itemId; });
}

export async function removeLocalOrderItem(orderId: string, itemId: string) {
  const order = await posDb.orders.get(orderId); if (!order) throw new Error("ORDER_NOT_FOUND"); const payload = { orderId, itemId, expectedVersion: order.version };
  return localOperation("REMOVE_ORDER_ITEM", payload, [posDb.orders, posDb.orderItems, posDb.orderItemModifiers], async () => { await posDb.orderItemModifiers.where("orderItemId").equals(itemId).delete(); await posDb.orderItems.delete(itemId); await posDb.orders.update(orderId, { version: order.version + 1 }); return itemId; });
}

export async function transferLocalOrder(orderId: string, destinationTableId: string) {
  const order = await posDb.orders.get(orderId); const destination = await posDb.restaurantTables.get(destinationTableId); if (!order) throw new Error("ORDER_NOT_FOUND"); if (!destination || !destination.isActive || destination.currentOrderId) throw new Error("TABLE_OCCUPIED");
  const payload = { id: orderId, expectedVersion: order.version, destinationTableId };
  return localOperation("TRANSFER_ORDER", payload, [posDb.orders, posDb.orderTables, posDb.restaurantTables], async () => { const assignments = await posDb.orderTables.where("orderId").equals(orderId).filter((row) => !row.releasedAt).toArray(); const now = new Date().toISOString(); for (const row of assignments) { await posDb.orderTables.update(row.id, { releasedAt: now }); await posDb.restaurantTables.update(row.tableId, { status: "AVAILABLE", currentOrderId: null }); } await posDb.orderTables.add({ id: crypto.randomUUID(), orderId, tableId: destinationTableId, assignedAt: now, isPrimary: true }); await posDb.restaurantTables.update(destinationTableId, { status: order.status === "BILL_REQUESTED" ? "BILL_REQUESTED" : "OCCUPIED", currentOrderId: orderId }); await posDb.orders.update(orderId, { version: order.version + 1 }); return orderId; });
}

export async function mergeLocalOrders(survivingOrderId: string, sourceOrderIds: string[]) {
  const survivor = await posDb.orders.get(survivingOrderId); if (!survivor) throw new Error("ORDER_NOT_FOUND"); const payload = { id: survivingOrderId, expectedVersion: survivor.version, sourceOrderIds };
  return localOperation("MERGE_ORDERS", payload, [posDb.orders, posDb.orderTables, posDb.orderItems, posDb.restaurantTables], async () => { for (const sourceId of sourceOrderIds) { const source = await posDb.orders.get(sourceId); if (!source || source.status !== "OPEN") throw new Error("INVALID_ORDER_STATE"); const assignments = await posDb.orderTables.where("orderId").equals(sourceId).filter((row) => !row.releasedAt).toArray(); await posDb.orderItems.where("orderId").equals(sourceId).modify({ orderId: survivingOrderId }); await posDb.orderTables.where("orderId").equals(sourceId).modify({ orderId: survivingOrderId, isPrimary: false }); for (const assignment of assignments) await posDb.restaurantTables.update(assignment.tableId, { currentOrderId: survivingOrderId, status: survivor.status === "BILL_REQUESTED" ? "BILL_REQUESTED" : "OCCUPIED" }); await posDb.orders.update(sourceId, { status: "MERGED" }); } await posDb.orders.update(survivingOrderId, { version: survivor.version + 1 }); return survivingOrderId; });
}

export async function openLocalShift(userId: string, openingCashMinor: string, businessDate: string) {
  const state = await posDb.deviceState.get("primary"); if (!state) throw new Error("DEVICE_NOT_PAIRED"); const id = crypto.randomUUID(); const payload = { id, openingCashMinor };
  return localOperation("OPEN_SHIFT", payload, [posDb.shifts], async () => { const current = await posDb.shifts.filter((row) => row.userId === userId && row.deviceId === state.deviceId && row.status === "OPEN").first(); if (current) throw new Error("SHIFT_ALREADY_OPEN"); const row = { id, userId, deviceId: state.deviceId, status: "OPEN", businessDate, openingCashMinor, cashSalesMinor: "0", cashRefundsMinor: "0", expectedCashMinor: openingCashMinor, openedAt: new Date().toISOString() }; await posDb.shifts.add(row); return row; });
}

export async function closeLocalShift(shiftId: string, actualClosingCashMinor: string) {
  const shift = await posDb.shifts.get(shiftId); if (!shift || shift.status !== "OPEN") throw new Error("SHIFT_NOT_OPEN"); const expected = BigInt(String(shift.expectedCashMinor)); const differenceMinor = (BigInt(actualClosingCashMinor) - expected).toString(); const payload = { id: shiftId, actualClosingCashMinor };
  return localOperation("CLOSE_SHIFT", payload, [posDb.shifts], async () => { await posDb.shifts.update(shiftId, { status: "CLOSED", actualClosingCashMinor, differenceMinor, closedAt: new Date().toISOString() }); return shiftId; });
}

export async function recordLocalPrintEvent(
  invoiceId: string,
  type: "INITIAL" | "REPRINT",
  profile: "58mm" | "80mm",
) {
  const invoice = await posDb.invoices.get(invoiceId);
  if (!invoice) throw new Error("INVOICE_NOT_FOUND");
  const id = crypto.randomUUID();
  const paperWidthMm = profile === "58mm" ? 58 : 80;
  const createdAt = new Date().toISOString();
  const payload = {
    id,
    invoiceId,
    type,
    paperWidthMm,
    profileName: profile,
  };
  return localOperation(
    "PRINT_EVENT",
    payload,
    [posDb.receiptPrintEvents],
    async () => {
      const event = {
        id,
        invoiceId,
        type,
        paperWidthMm: paperWidthMm as 58 | 80,
        profileName: profile,
        createdAt,
      };
      await posDb.receiptPrintEvents.add(event);
      return event;
    },
  );
}

function overlaps(startA: string, endA: string | null | undefined, startB: string, endB: string | null | undefined) {
  const fallback = (start: string) => new Date(new Date(start).getTime() + 90 * 60_000).toISOString();
  return startA < (endB ?? fallback(startB)) && startB < (endA ?? fallback(startA));
}

export async function createLocalReservation(input: Omit<LocalReservation, "id" | "version">) {
  const id = crypto.randomUUID(); const row: LocalReservation = { ...input, id, version: 1 };
  const payload = { id, customerName: row.customerName, phone: row.phone, guestCount: row.guestCount, startsAt: row.startsAt, endsAt: row.endsAt, notes: row.notes, status: row.status, tableIds: row.tableIds };
  return localOperation("CREATE_RESERVATION", payload, [posDb.reservations], async () => {
    const active = await posDb.reservations.filter((reservation) => !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(reservation.status) && reservation.tableIds.some((tableId) => row.tableIds.includes(tableId)) && overlaps(row.startsAt, row.endsAt, reservation.startsAt, reservation.endsAt)).first();
    if (active) throw new Error("RESERVATION_OVERLAP"); await posDb.reservations.add(row); return row;
  });
}

export async function updateLocalReservation(id: string, patch: Partial<Omit<LocalReservation, "id" | "version">>) {
  const current = await posDb.reservations.get(id); if (!current) throw new Error("RESERVATION_NOT_FOUND"); const next = { ...current, ...patch, version: current.version + 1 };
  const payload = { id, expectedVersion: current.version, ...patch };
  return localOperation("UPDATE_RESERVATION", payload, [posDb.reservations], async () => {
    if (!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(next.status)) { const active = await posDb.reservations.filter((reservation) => reservation.id !== id && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(reservation.status) && reservation.tableIds.some((tableId) => next.tableIds.includes(tableId)) && overlaps(next.startsAt, next.endsAt, reservation.startsAt, reservation.endsAt)).first(); if (active) throw new Error("RESERVATION_OVERLAP"); }
    await posDb.reservations.put(next); return next;
  });
}

export async function checkoutLocal(input: { orderId: string; userId: string; businessDate: string; payments: { method: "CASH"; amountMinor: string; tenderedMinor: string }[] }) {
  const order = await posDb.orders.get(input.orderId); if (!order) throw new Error("ORDER_NOT_FOUND");
  const items = await posDb.orderItems.where("orderId").equals(input.orderId).toArray(); if (!items.length) throw new Error("EMPTY_ORDER");
  const subtotalMinor = addMinor(...items.map((item) => item.lineTotalMinor)); const allocated = addMinor(...input.payments.map((payment) => payment.amountMinor)); if (allocated !== subtotalMinor) throw new Error("INVALID_PAYMENT_TOTAL");
  const state = await posDb.deviceState.get("primary"); if (!state) throw new Error("DEVICE_NOT_PAIRED");
  const shift = await posDb.shifts.filter((row) => row.userId === input.userId && row.deviceId === state.deviceId && row.status === "OPEN").first(); if (!shift) throw new Error("SHIFT_REQUIRED");
  const invoiceId = crypto.randomUUID(); const year = Number(input.businessDate.slice(0, 4)); const sequence = state.invoiceYear === year ? state.nextInvoiceSequence : 1; const invoiceNumber = `RWQ-${state.deviceCode}-${year}-${sequence.toString().padStart(6, "0")}`;
  const paymentRows: LocalPayment[] = input.payments.map((payment) => { const amount = BigInt(payment.amountMinor); const tendered = payment.method === "CASH" ? BigInt(payment.tenderedMinor) : null; if (tendered !== null && tendered < amount) throw new Error("INVALID_CASH_TENDER"); return { id: crypto.randomUUID(), invoiceId, method: payment.method, amountMinor: payment.amountMinor, tenderedMinor: tendered?.toString() ?? null, changeMinor: tendered === null ? null : (tendered - amount).toString(), status: "COMPLETED", paidAt: new Date().toISOString() }; });
  const payload = { id: invoiceId, orderId: input.orderId, expectedVersion: order.version, invoiceNumber, payments: paymentRows.map((payment) => ({ id: payment.id, method: payment.method, amountMinor: payment.amountMinor, ...(payment.method === "CASH" ? { tenderedMinor: payment.tenderedMinor } : {}) })) };
  return localOperation("FINALIZE_INVOICE", payload, [posDb.invoices, posDb.invoiceLines, posDb.invoiceModifiers, posDb.orderItemModifiers, posDb.payments, posDb.orders, posDb.orderTables, posDb.restaurantTables, posDb.shifts], async () => {
    const invoice: LocalInvoice = { id: invoiceId, invoiceNumber, orderId: input.orderId, status: "PAID", businessDate: input.businessDate, subtotalMinor, discountMinor: "0", totalMinor: subtotalMinor, refundedMinor: "0", cashierId: input.userId, deviceId: state.deviceId, issuedAt: new Date().toISOString() };
    const invoiceLines = items.map((item) => ({ id: crypto.randomUUID(), invoiceId, orderItemId: item.id, menuItemId: item.menuItemId, itemNameSnapshot: item.itemNameSnapshot, itemNameEnSnapshot: item.itemNameEnSnapshot, unitPriceMinor: item.unitPriceMinor, quantity: item.quantity, subtotalMinor: item.lineTotalMinor, discountMinor: "0", totalMinor: item.lineTotalMinor, notes: item.notes, sortOrder: item.sortOrder }));
    const lineByOrderItem = new Map(invoiceLines.map((line) => [line.orderItemId, line.id])); const orderModifiers = await posDb.orderItemModifiers.where("orderItemId").anyOf(items.map((item) => item.id)).toArray();
    const invoiceModifiers = orderModifiers.map((modifier) => ({ id: crypto.randomUUID(), invoiceLineId: lineByOrderItem.get(modifier.orderItemId)!, modifierOptionId: modifier.modifierOptionId, groupNameSnapshot: modifier.groupNameSnapshot, optionNameSnapshot: modifier.optionNameSnapshot, priceTypeSnapshot: modifier.priceTypeSnapshot, unitPriceMinor: modifier.unitPriceMinor, quantity: modifier.quantity, totalMinor: modifier.lineTotalMinor }));
    await posDb.invoices.add(invoice); await posDb.payments.bulkAdd(paymentRows); await posDb.invoiceLines.bulkAdd(invoiceLines); if (invoiceModifiers.length) await posDb.invoiceModifiers.bulkAdd(invoiceModifiers);
    await posDb.orders.update(input.orderId, { status: "CLOSED", version: order.version + 1 }); const assignments = await posDb.orderTables.where("orderId").equals(input.orderId).filter((row) => !row.releasedAt).toArray(); const now = new Date().toISOString(); for (const assignment of assignments) { await posDb.orderTables.update(assignment.id, { releasedAt: now }); await posDb.restaurantTables.update(assignment.tableId, { status: "AVAILABLE", currentOrderId: null }); }
    await posDb.deviceState.update("primary", { invoiceYear: year, nextInvoiceSequence: sequence + 1 }); return invoice;
  });
}

export async function finalizeLocalItemSplit(input: { orderId: string; userId: string; businessDate: string; lines: { orderItemId: string; quantity: number }[]; splitGroupId: string; splitIndex: number; splitCount: number; dependencies?: string[] }) {
  const order = await posDb.orders.get(input.orderId); if (!order || !["OPEN", "BILL_REQUESTED", "PARTIALLY_BILLED"].includes(order.status)) throw new Error("INVALID_ORDER_STATE");
  const state = await posDb.deviceState.get("primary"); if (!state) throw new Error("DEVICE_NOT_PAIRED");
  const items = await posDb.orderItems.where("orderId").equals(input.orderId).sortBy("sortOrder");
  const priorLines = await posDb.invoiceLines.toArray(); const billedByItem = new Map<string, number>();
  for (const line of priorLines.filter((line) => items.some((item) => item.id === line.orderItemId))) billedByItem.set(line.orderItemId, (billedByItem.get(line.orderItemId) ?? 0) + line.quantity);
  const requested = new Map(input.lines.map((line) => [line.orderItemId, line.quantity]));
  const selected = items.flatMap((item) => { const quantity = requested.get(item.id) ?? 0; const remaining = item.quantity - (billedByItem.get(item.id) ?? 0); if (!Number.isInteger(quantity) || quantity < 0 || quantity > remaining) throw new Error("INVALID_QUANTITY"); return quantity > 0 ? [{ item, quantity }] : []; });
  if (!selected.length) throw new Error("INVALID_QUANTITY");
  const totalMinor = addMinor(...selected.map(({ item, quantity }) => multiplyMinor(item.unitPriceMinor, quantity)));
  const invoiceId = crypto.randomUUID(); const year = Number(input.businessDate.slice(0, 4)); const sequence = state.invoiceYear === year ? state.nextInvoiceSequence : 1; const invoiceNumber = `RWQ-${state.deviceCode}-${year}-${sequence.toString().padStart(6, "0")}`;
  const payload = { id: invoiceId, orderId: input.orderId, expectedVersion: order.version, invoiceNumber, lines: input.lines, split: { groupId: input.splitGroupId, index: input.splitIndex, count: input.splitCount } };
  return localOperation("FINALIZE_INVOICE", payload, [posDb.invoices, posDb.invoiceLines, posDb.invoiceModifiers, posDb.orderItemModifiers, posDb.orders, posDb.deviceState], async () => {
    const now = new Date().toISOString();
    const invoice: LocalInvoice = { id: invoiceId, invoiceNumber, orderId: input.orderId, status: "OPEN", businessDate: input.businessDate, subtotalMinor: totalMinor, discountMinor: "0", totalMinor, refundedMinor: "0", cashierId: input.userId, deviceId: state.deviceId, issuedAt: now, splitGroupId: input.splitGroupId, splitMode: "ITEM", splitIndex: input.splitIndex, splitCount: input.splitCount };
    const lines = selected.map(({ item, quantity }) => ({ id: crypto.randomUUID(), invoiceId, orderItemId: item.id, menuItemId: item.menuItemId, itemNameSnapshot: item.itemNameSnapshot, itemNameEnSnapshot: item.itemNameEnSnapshot, unitPriceMinor: item.unitPriceMinor, quantity, subtotalMinor: multiplyMinor(item.unitPriceMinor, quantity), discountMinor: "0", totalMinor: multiplyMinor(item.unitPriceMinor, quantity), notes: item.notes, sortOrder: item.sortOrder }));
    const lineByItem = new Map(lines.map((line) => [line.orderItemId, line.id])); const modifiers = await posDb.orderItemModifiers.where("orderItemId").anyOf(selected.map(({ item }) => item.id)).toArray();
    await posDb.invoices.add(invoice); await posDb.invoiceLines.bulkAdd(lines); if (modifiers.length) await posDb.invoiceModifiers.bulkAdd(modifiers.map((modifier) => ({ id: crypto.randomUUID(), invoiceLineId: lineByItem.get(modifier.orderItemId)!, modifierOptionId: modifier.modifierOptionId, groupNameSnapshot: modifier.groupNameSnapshot, optionNameSnapshot: modifier.optionNameSnapshot, priceTypeSnapshot: modifier.priceTypeSnapshot, unitPriceMinor: modifier.unitPriceMinor, quantity: modifier.quantity, totalMinor: modifier.lineTotalMinor })));
    await posDb.orders.update(input.orderId, { status: "PARTIALLY_BILLED", version: order.version + 1 }); await posDb.deviceState.update("primary", { invoiceYear: year, nextInvoiceSequence: sequence + 1 }); return invoice;
  }, input.dependencies ?? []);
}

export async function finalizeLocalEqualSplit(input: { orderId: string; userId: string; businessDate: string; splitCount: number; payments?: { method: "CASH"; amountMinor: string; tenderedMinor: string }[][] }) {
  if (!Number.isInteger(input.splitCount) || input.splitCount < 2 || input.splitCount > 50) throw new Error("INVALID_SPLIT_COUNT");
  if (input.payments && input.payments.length !== input.splitCount) throw new Error("INVALID_SPLIT_COUNT");
  const order = await posDb.orders.get(input.orderId); if (!order || !["OPEN", "BILL_REQUESTED"].includes(order.status)) throw new Error("INVALID_ORDER_STATE");
  const items = await posDb.orderItems.where("orderId").equals(input.orderId).sortBy("sortOrder"); if (!items.length) throw new Error("EMPTY_ORDER");
  const state = await posDb.deviceState.get("primary"); if (!state) throw new Error("DEVICE_NOT_PAIRED");
  const splitGroupId = crypto.randomUUID(); const year = Number(input.businessDate.slice(0, 4)); const firstSequence = state.invoiceYear === year ? state.nextInvoiceSequence : 1;
  const totalMinor = addMinor(...items.map((item) => item.lineTotalMinor)); const totalShares = splitMinorEqual(totalMinor, input.splitCount); const lineMatrix = allocateMinorLinesToTargets(items.map((item) => item.lineTotalMinor), totalShares);
  const invoices = Array.from({ length: input.splitCount }, (_, index) => ({ id: crypto.randomUUID(), invoiceNumber: `RWQ-${state.deviceCode}-${year}-${(firstSequence + index).toString().padStart(6, "0")}`, splitIndex: index + 1 }));
  const allocationRows: LocalInvoiceAllocationLine[] = invoices.flatMap((invoice, splitIndex) => items.map((item, itemIndex) => ({ id: crypto.randomUUID(), invoiceId: invoice.id, orderItemId: item.id, menuItemId: item.menuItemId, itemNameSnapshot: item.itemNameSnapshot, itemNameEnSnapshot: item.itemNameEnSnapshot, unitPriceMinor: item.unitPriceMinor, quantityNumerator: String(item.quantity), quantityDenominator: String(input.splitCount), subtotalMinor: lineMatrix[itemIndex]![splitIndex]!, discountMinor: "0", totalMinor: lineMatrix[itemIndex]![splitIndex]!, notes: item.notes, sortOrder: item.sortOrder })));
  const payload = { orderId: input.orderId, expectedVersion: order.version, splitGroupId, splitCount: input.splitCount, invoices: invoices.map((invoice, index) => ({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, allocations: items.map((item) => ({ orderItemId: item.id, quantityNumerator: String(item.quantity), quantityDenominator: String(input.splitCount) })), payments: input.payments?.[index]?.map((payment) => ({ id: crypto.randomUUID(), ...payment })) })) };
  return localOperation("FINALIZE_EQUAL_SPLIT", payload, [posDb.invoices, posDb.invoiceAllocationLines, posDb.invoiceAllocationModifiers, posDb.orderItemModifiers, posDb.payments, posDb.shifts, posDb.orders, posDb.orderTables, posDb.restaurantTables], async () => {
    const now = new Date().toISOString(); const modifiers = await posDb.orderItemModifiers.where("orderItemId").anyOf(items.map((item) => item.id)).toArray(); let allPaid = true; const localInvoices: LocalInvoice[] = []; const paymentRows: LocalPayment[] = [];
    if (input.payments?.some((rows) => rows.length)) { const shift = await posDb.shifts.filter((row) => row.userId === input.userId && row.deviceId === state.deviceId && row.status === "OPEN").first(); if (!shift) throw new Error("SHIFT_REQUIRED"); }
    for (let index = 0; index < invoices.length; index += 1) {
      const spec = invoices[index]!; const sharePayments = payload.invoices[index]!.payments ?? []; const allocated = addMinor(...sharePayments.map((payment) => payment.amountMinor)); if (sharePayments.length && allocated !== totalShares[index]) throw new Error("INVALID_PAYMENT_TOTAL");
      const paid = totalShares[index] === "0" || allocated === totalShares[index]; allPaid = allPaid && paid;
      const invoice: LocalInvoice = { id: spec.id, invoiceNumber: spec.invoiceNumber, orderId: input.orderId, status: paid ? "PAID" : "OPEN", businessDate: input.businessDate, subtotalMinor: totalShares[index]!, discountMinor: "0", totalMinor: totalShares[index]!, refundedMinor: "0", cashierId: input.userId, deviceId: state.deviceId, issuedAt: now, splitGroupId, splitMode: "EQUAL", splitIndex: index + 1, splitCount: input.splitCount };
      localInvoices.push(invoice);
      for (const payment of sharePayments) { const amount = BigInt(payment.amountMinor); const tendered = payment.method === "CASH" ? BigInt(payment.tenderedMinor) : null; if (tendered !== null && tendered < amount) throw new Error("INVALID_CASH_TENDER"); paymentRows.push({ id: payment.id, invoiceId: spec.id, method: payment.method, amountMinor: payment.amountMinor, tenderedMinor: tendered?.toString() ?? null, changeMinor: tendered === null ? null : (tendered - amount).toString(), status: "COMPLETED", paidAt: now }); }
    }
    await posDb.invoices.bulkAdd(localInvoices); await posDb.invoiceAllocationLines.bulkAdd(allocationRows); if (paymentRows.length) await posDb.payments.bulkAdd(paymentRows);
    const allocationByItemInvoice = new Map(allocationRows.map((row) => [`${row.invoiceId}:${row.orderItemId}`, row.id]));
    const modifierRows = invoices.flatMap((invoice) => modifiers.map((modifier) => ({ id: crypto.randomUUID(), invoiceAllocationLineId: allocationByItemInvoice.get(`${invoice.id}:${modifier.orderItemId}`)!, modifierOptionId: modifier.modifierOptionId, groupNameSnapshot: modifier.groupNameSnapshot, optionNameSnapshot: modifier.optionNameSnapshot, priceTypeSnapshot: modifier.priceTypeSnapshot, unitPriceMinor: modifier.unitPriceMinor, quantity: modifier.quantity, totalMinor: modifier.lineTotalMinor })));
    if (modifierRows.length) await posDb.invoiceAllocationModifiers.bulkAdd(modifierRows);
    await posDb.orders.update(input.orderId, { status: allPaid ? "CLOSED" : "PARTIALLY_BILLED", version: order.version + 1 });
    if (allPaid) { const assignments = await posDb.orderTables.where("orderId").equals(input.orderId).filter((row) => !row.releasedAt).toArray(); for (const assignment of assignments) { await posDb.orderTables.update(assignment.id, { releasedAt: now }); await posDb.restaurantTables.update(assignment.tableId, { status: "AVAILABLE", currentOrderId: null }); } }
    await posDb.deviceState.update("primary", { invoiceYear: year, nextInvoiceSequence: firstSequence + input.splitCount }); return { splitGroupId, invoices: localInvoices };
  });
}

export async function payLocalInvoice(input: { invoiceId: string; userId: string; method: "CASH"; amountMinor: string; tenderedMinor?: string }) {
  const invoice = await posDb.invoices.get(input.invoiceId); if (!invoice) throw new Error("INVOICE_NOT_FOUND"); if (invoice.status !== "OPEN") throw new Error("INVOICE_ALREADY_PAID");
  const existing = await posDb.payments.where("invoiceId").equals(invoice.id).toArray(); const alreadyPaid = existing.reduce((sum, payment) => sum + BigInt(payment.amountMinor), 0n); const due = BigInt(invoice.totalMinor) - alreadyPaid; const amount = BigInt(input.amountMinor);
  if (amount <= 0n || amount > due) throw new Error("INVALID_PAYMENT_TOTAL"); const tendered = input.method === "CASH" ? BigInt(input.tenderedMinor ?? "0") : null; if (tendered !== null && tendered < amount) throw new Error("INVALID_CASH_TENDER");
  const state = await posDb.deviceState.get("primary"); if (!state) throw new Error("DEVICE_NOT_PAIRED"); const paymentId = crypto.randomUUID(); const payload = { invoiceId: invoice.id, id: paymentId, method: input.method, amountMinor: amount.toString(), ...(tendered === null ? {} : { tenderedMinor: tendered.toString() }) };
  return localOperation("CREATE_PAYMENT", payload, [posDb.invoices, posDb.payments, posDb.shifts, posDb.orders, posDb.orderTables, posDb.restaurantTables], async () => {
    const shift = await posDb.shifts.filter((row) => row.userId === input.userId && row.deviceId === state.deviceId && row.status === "OPEN").first(); if (!shift) throw new Error("SHIFT_REQUIRED");
    const payment: LocalPayment = { id: paymentId, invoiceId: invoice.id, method: input.method, amountMinor: amount.toString(), tenderedMinor: tendered?.toString() ?? null, changeMinor: tendered === null ? null : (tendered - amount).toString(), status: "COMPLETED", paidAt: new Date().toISOString() }; await posDb.payments.add(payment);
    if (input.method === "CASH") { const cashSales = BigInt(String(shift.cashSalesMinor ?? "0")) + amount; const expected = BigInt(String(shift.expectedCashMinor ?? "0")) + amount; await posDb.shifts.update(String(shift.id), { cashSalesMinor: cashSales.toString(), expectedCashMinor: expected.toString() }); }
    const fullyPaid = alreadyPaid + amount === BigInt(invoice.totalMinor); if (fullyPaid) await posDb.invoices.update(invoice.id, { status: "PAID" });
    if (fullyPaid) { const siblings = await posDb.invoices.where("orderId").equals(invoice.orderId).toArray(); if (siblings.every((row) => row.id === invoice.id ? true : row.status !== "OPEN")) { const order = await posDb.orders.get(invoice.orderId); if (order && order.status !== "CLOSED") { const now = new Date().toISOString(); await posDb.orders.update(order.id, { status: "CLOSED", version: order.version + 1 }); const assignments = await posDb.orderTables.where("orderId").equals(order.id).filter((row) => !row.releasedAt).toArray(); for (const assignment of assignments) { await posDb.orderTables.update(assignment.id, { releasedAt: now }); await posDb.restaurantTables.update(assignment.tableId, { status: "AVAILABLE", currentOrderId: null }); } } } }
    return payment;
  });
}

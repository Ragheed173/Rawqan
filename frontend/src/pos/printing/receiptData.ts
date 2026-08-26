import { posDb } from "../db/schema";
import type { ReceiptData } from "./ReceiptPrinter";

export async function loadReceiptData(
  invoiceId: string,
  cashierName: string,
  isReprint = false,
): Promise<ReceiptData> {
  const invoice = await posDb.invoices.get(invoiceId);
  if (!invoice) throw new Error("INVOICE_NOT_FOUND");

  const [state, items, allocationLines, payments, assignments] =
    await Promise.all([
      posDb.deviceState.get("primary"),
      posDb.invoiceLines.where("invoiceId").equals(invoiceId).sortBy("sortOrder"),
      posDb.invoiceAllocationLines
        .where("invoiceId")
        .equals(invoiceId)
        .sortBy("sortOrder"),
      posDb.payments.where("invoiceId").equals(invoiceId).toArray(),
      posDb.orderTables.where("orderId").equals(invoice.orderId).toArray(),
    ]);
  const [allModifiers, allAllocationModifiers, tables] = await Promise.all([
    posDb.invoiceModifiers.toArray(),
    posDb.invoiceAllocationModifiers.toArray(),
    posDb.restaurantTables.bulkGet([
      ...new Set(assignments.map((assignment) => assignment.tableId)),
    ]),
  ]);
  const itemIds = new Set(items.map((item) => item.id));
  const allocationLineIds = new Set(allocationLines.map((line) => line.id));

  return {
    restaurantName: state?.restaurantName ?? "روقان",
    footer: state?.receiptFooter,
    invoice,
    tableNames: tables.flatMap((table) =>
      table ? [table.displayName?.trim() || table.code] : [],
    ),
    cashierName,
    items,
    modifiers: allModifiers.filter((row) => itemIds.has(row.invoiceLineId)),
    allocationLines,
    allocationModifiers: allAllocationModifiers.filter((row) =>
      allocationLineIds.has(row.invoiceAllocationLineId),
    ),
    payments,
    isReprint,
  };
}

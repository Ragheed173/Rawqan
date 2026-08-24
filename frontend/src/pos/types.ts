export type MinorString = string;
export type SyncState = "PENDING" | "SYNCING" | "SUCCEEDED" | "FAILED" | "CONFLICT";

export interface LocalOrder { id: string; status: "OPEN" | "BILL_REQUESTED" | "PARTIALLY_BILLED" | "CLOSED" | "CANCELLED" | "MERGED"; version: number; businessDate: string; deviceId: string; openedById: string; openedAt: string; guestCount?: number | null; notes?: string | null; }
export interface LocalOrderTable { id: string; orderId: string; tableId: string; assignedAt: string; releasedAt?: string | null; isPrimary: boolean; }
export interface LocalOrderItem { id: string; orderId: string; menuItemId?: string | null; itemNameSnapshot: string; itemNameEnSnapshot?: string | null; unitPriceMinor: MinorString; quantity: number; lineTotalMinor: MinorString; notes?: string | null; sortOrder: number; }
export interface LocalOrderModifier { id: string; orderItemId: string; modifierOptionId?: string | null; groupNameSnapshot: string; optionNameSnapshot: string; priceTypeSnapshot: "DELTA" | "REPLACEMENT"; unitPriceMinor: MinorString; quantity: number; lineTotalMinor: MinorString; }
export interface LocalInvoice { id: string; invoiceNumber: string; orderId: string; status: "OPEN" | "PAID" | "VOIDED" | "PARTIALLY_REFUNDED" | "REFUNDED"; businessDate: string; subtotalMinor: MinorString; discountMinor: MinorString; totalMinor: MinorString; refundedMinor: MinorString; cashierId: string; deviceId: string; issuedAt: string; splitGroupId?: string | null; splitMode?: "ITEM" | "EQUAL" | null; splitIndex?: number | null; splitCount?: number | null; }
export interface LocalInvoiceLine { id: string; invoiceId: string; orderItemId: string; menuItemId?: string | null; itemNameSnapshot: string; itemNameEnSnapshot?: string | null; unitPriceMinor: MinorString; quantity: number; subtotalMinor: MinorString; discountMinor: MinorString; totalMinor: MinorString; notes?: string | null; sortOrder: number; }
export interface LocalInvoiceModifier { id: string; invoiceLineId: string; modifierOptionId?: string | null; groupNameSnapshot: string; optionNameSnapshot: string; priceTypeSnapshot: "DELTA" | "REPLACEMENT"; unitPriceMinor: MinorString; quantity: number; totalMinor: MinorString; }
export interface LocalInvoiceAllocationLine { id: string; invoiceId: string; orderItemId: string; menuItemId?: string | null; itemNameSnapshot: string; itemNameEnSnapshot?: string | null; unitPriceMinor: MinorString; quantityNumerator: MinorString; quantityDenominator: MinorString; subtotalMinor: MinorString; discountMinor: MinorString; totalMinor: MinorString; notes?: string | null; sortOrder: number; }
export interface LocalInvoiceAllocationModifier { id: string; invoiceAllocationLineId: string; modifierOptionId?: string | null; groupNameSnapshot: string; optionNameSnapshot: string; priceTypeSnapshot: "DELTA" | "REPLACEMENT"; unitPriceMinor: MinorString; quantity: number; totalMinor: MinorString; }
export interface LocalPayment { id: string; invoiceId: string; method: "CASH" | "VISA"; amountMinor: MinorString; tenderedMinor?: MinorString | null; changeMinor?: MinorString | null; status: "COMPLETED" | "VOIDED" | "REFUNDED"; paidAt: string; }
export interface SyncOperation { operationId: string; deviceId: string; localSequence: MinorString; requestHash: string; operationType: string; payload: Record<string, unknown>; dependencies: string[]; status: SyncState; attempts: number; nextAttemptAt?: string; errorCode?: string; errorMessage?: string; createdAt: string; processedAt?: string; }
export interface DeviceState { key: "primary"; deviceId: string; deviceCode: string; nextLocalSequence: MinorString; invoiceYear: number; nextInvoiceSequence: number; catalogRevision: MinorString; lastSuccessfulSync?: string; timezone?: string; businessDayCutoff?: string; restaurantName?: string; receiptFooter?: string | null; }
export interface OfflineSession { id: string; deviceId: string; userId: string; role: string; permissions: string[]; capability: string; expiresAt: string; unlockedAt?: string; failedPinAttempts?: number; lockedUntil?: string; }

export const addMinor = (...values: MinorString[]) => values.reduce((total, value) => total + BigInt(value), 0n).toString();
export const multiplyMinor = (value: MinorString, quantity: number) => (BigInt(value) * BigInt(quantity)).toString();
export function splitMinorEqual(value: MinorString, parts: number): MinorString[] {
  if (!Number.isInteger(parts) || parts <= 0) throw new Error("INVALID_SPLIT_COUNT");
  const total = BigInt(value); const count = BigInt(parts); const base = total / count; const remainder = Number(total % count);
  return Array.from({ length: parts }, (_, index) => (base + (index < remainder ? 1n : 0n)).toString());
}

export function allocateMinorLinesToTargets(lineTotals: MinorString[], targets: MinorString[]): MinorString[][] {
  const matrix = lineTotals.map((line) => splitMinorEqual(line, targets.length).map(BigInt));
  const wanted = targets.map(BigInt); const columns = wanted.map((_target, column) => matrix.reduce((sum, row) => sum + row[column]!, 0n));
  if (lineTotals.reduce((sum, value) => sum + BigInt(value), 0n) !== wanted.reduce((sum, value) => sum + value, 0n)) throw new Error("INVALID_SPLIT_TOTAL");
  for (let receiver = 0; receiver < wanted.length; receiver += 1) {
    let deficit = wanted[receiver]! - columns[receiver]!;
    while (deficit > 0n) {
      const donor = columns.findIndex((total, index) => index !== receiver && total > wanted[index]!); if (donor < 0) throw new Error("INVALID_SPLIT_TOTAL");
      const row = matrix.findIndex((values) => values[donor]! > 0n); if (row < 0) throw new Error("INVALID_SPLIT_TOTAL");
      const amount = [deficit, columns[donor]! - wanted[donor]!, matrix[row]![donor]!].reduce((lowest, value) => value < lowest ? value : lowest);
      matrix[row]![donor] -= amount; matrix[row]![receiver] += amount; columns[donor] -= amount; columns[receiver] += amount; deficit -= amount;
    }
  }
  return matrix.map((row) => row.map(String));
}

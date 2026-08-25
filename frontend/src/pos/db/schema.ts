import Dexie, { type EntityTable } from "dexie";
import type { DeviceState, LocalInvoice, LocalInvoiceAllocationLine, LocalInvoiceAllocationModifier, LocalInvoiceLine, LocalInvoiceModifier, LocalOrder, LocalOrderItem, LocalOrderModifier, LocalOrderTable, LocalPayment, LocalReceiptPrintEvent, OfflineSession, SyncOperation } from "../types";

export interface CatalogMeta { key: string; revision: string; updatedAt: string }
export interface LocalCategory { id: string; name: string; nameEn?: string | null; isActive: boolean; sortOrder: number }
export interface LocalMenuItem { id: string; categoryId: string; name: string; nameEn?: string | null; priceMinor: string; discountPriceMinor?: string | null; isAvailable: boolean; isArchived: boolean; sortOrder: number }
export interface LocalModifierGroup { id: string; type: "VARIANT" | "ADD_ON"; name: string; minSelections: number; maxSelections: number; isRequired: boolean; isActive: boolean; sortOrder: number }
export interface LocalModifierOption { id: string; groupId: string; name: string; priceType: "DELTA" | "REPLACEMENT"; priceMinor: string; isActive: boolean; sortOrder: number }
export interface LocalMenuModifierLink { id: string; menuItemId: string; groupId: string; sortOrder: number }
export interface LocalTable { id: string; code: string; displayName?: string | null; capacity?: number | null; status: string; isActive: boolean; sortOrder: number; currentOrderId?: string | null; }
export interface LocalReservation { id: string; customerName: string; phone: string; guestCount: number; startsAt: string; endsAt?: string | null; notes?: string | null; status: string; version: number; tableIds: string[] }
export interface GenericRecord { id: string; [key: string]: unknown }

export class PosDatabase extends Dexie {
  catalogMeta!: EntityTable<CatalogMeta, "key">; categories!: EntityTable<LocalCategory, "id">; menuItems!: EntityTable<LocalMenuItem, "id">;
  modifierGroups!: EntityTable<LocalModifierGroup, "id">; modifierOptions!: EntityTable<LocalModifierOption, "id">; menuItemModifierGroups!: EntityTable<LocalMenuModifierLink, "id">;
  restaurantTables!: EntityTable<LocalTable, "id">; reservations!: EntityTable<LocalReservation, "id">;
  orders!: EntityTable<LocalOrder, "id">; orderTables!: EntityTable<LocalOrderTable, "id">; orderItems!: EntityTable<LocalOrderItem, "id">; orderItemModifiers!: EntityTable<LocalOrderModifier, "id">;
  invoices!: EntityTable<LocalInvoice, "id">; invoiceLines!: EntityTable<LocalInvoiceLine, "id">; invoiceModifiers!: EntityTable<LocalInvoiceModifier, "id">; discounts!: EntityTable<GenericRecord, "id">; payments!: EntityTable<LocalPayment, "id">; refunds!: EntityTable<GenericRecord, "id">; shifts!: EntityTable<GenericRecord, "id">;
  invoiceAllocationLines!: EntityTable<LocalInvoiceAllocationLine, "id">; invoiceAllocationModifiers!: EntityTable<LocalInvoiceAllocationModifier, "id">;
  receiptPrintEvents!: EntityTable<LocalReceiptPrintEvent, "id">;
  syncOperations!: EntityTable<SyncOperation, "operationId">; deviceState!: EntityTable<DeviceState, "key">; offlineSession!: EntityTable<OfflineSession, "id">;

  constructor(name = "rawaqan-pos") {
    super(name);
    this.on("blocked", () => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rawaqan-pos-storage-blocked")); });
    this.version(1).stores({
      catalogMeta: "key", categories: "id, isActive, sortOrder", menuItems: "id, categoryId, isAvailable, sortOrder",
      modifierGroups: "id, type, isActive, sortOrder", modifierOptions: "id, groupId, isActive, sortOrder", menuItemModifierGroups: "id, menuItemId, groupId",
      restaurantTables: "id, code, status, sortOrder", reservations: "id, startsAt, status, *tableIds",
      orders: "id, status, businessDate, openedAt", orderTables: "id, orderId, tableId, releasedAt", orderItems: "id, orderId, sortOrder", orderItemModifiers: "id, orderItemId",
      invoices: "id, &invoiceNumber, orderId, status, businessDate, issuedAt", invoiceLines: "id, invoiceId, orderItemId", invoiceModifiers: "id, invoiceLineId", discounts: "id, orderId, invoiceId", payments: "id, invoiceId, method, paidAt", refunds: "id, invoiceId, refundedAt", shifts: "id, userId, deviceId, status",
      syncOperations: "operationId, [deviceId+localSequence], status, nextAttemptAt, createdAt", deviceState: "key", offlineSession: "id, deviceId, userId, expiresAt",
    });
    this.version(2).stores({
      invoiceAllocationLines: "id, invoiceId, orderItemId",
      invoiceAllocationModifiers: "id, invoiceAllocationLineId",
    });
    this.version(3).stores({
      receiptPrintEvents: "id, invoiceId, type, createdAt",
    });
  }
}

export const posDb = new PosDatabase();

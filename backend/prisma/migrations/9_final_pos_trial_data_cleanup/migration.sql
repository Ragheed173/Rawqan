-- Final one-time removal of pre-handover POS trial data.
-- Catalog, users, restaurant settings, dining-table configuration, paired
-- devices, and general website analytics are intentionally preserved.
BEGIN;

TRUNCATE TABLE
  "refund_payments",
  "refund_lines",
  "refunds",
  "receipt_print_events",
  "invoice_voids",
  "payments",
  "invoice_discounts",
  "invoice_line_modifiers",
  "invoice_lines",
  "invoice_allocation_line_modifiers",
  "invoice_allocation_lines",
  "invoice_table_snapshots",
  "invoice_orders",
  "invoices",
  "order_discounts",
  "order_item_modifiers",
  "order_items",
  "order_table_assignments",
  "orders",
  "reservation_tables",
  "reservations",
  "cashier_shifts",
  "sync_operations"
RESTART IDENTITY;

DELETE FROM "activity_logs"
WHERE "action" IN (
  'ORDER_CREATED',
  'ORDER_UPDATED',
  'ORDER_CANCELLED',
  'TABLE_TRANSFERRED',
  'TABLES_MERGED',
  'DISCOUNT_APPLIED',
  'INVOICE_CREATED',
  'PAYMENT_CREATED',
  'INVOICE_VOIDED',
  'REFUND_CREATED',
  'SHIFT_OPENED',
  'SHIFT_CLOSED',
  'INVOICE_PRINTED',
  'INVOICE_REPRINTED',
  'POS_SYNC_APPLIED',
  'RESERVATION_CREATED',
  'RESERVATION_UPDATED',
  'RESERVATION_CANCELLED'
);

UPDATE "dining_tables"
SET
  "status" = CASE
    WHEN "is_active" THEN 'AVAILABLE'::"DiningTableStatus"
    ELSE 'DISABLED'::"DiningTableStatus"
  END,
  "updated_at" = CURRENT_TIMESTAMP;

COMMIT;

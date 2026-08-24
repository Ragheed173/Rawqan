-- Phase 2: additive POS database schema and database-level safety foundations.
-- Existing CUID models and MenuItem Decimal prices are intentionally unchanged.

CREATE TYPE "DiningTableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'DISABLED');
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'BILL_REQUESTED', 'PARTIALLY_BILLED', 'CLOSED', 'CANCELLED', 'MERGED');
CREATE TYPE "ModifierGroupType" AS ENUM ('VARIANT', 'ADD_ON');
CREATE TYPE "ModifierPriceType" AS ENUM ('DELTA', 'REPLACEMENT');
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOIDED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'VISA');
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'VOIDED', 'REFUNDED');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "CashierShiftStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ReceiptPrintType" AS ENUM ('INITIAL', 'REPRINT');
CREATE TYPE "SyncOperationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CONFLICT');

CREATE TABLE "pos_devices" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "paired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pos_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dining_tables" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "display_name" TEXT,
  "capacity" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" "DiningTableStatus" NOT NULL DEFAULT 'AVAILABLE',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "guest_count" INTEGER,
  "notes" TEXT,
  "business_date" DATE NOT NULL,
  "opened_by_id" TEXT,
  "opened_by_name_snapshot" TEXT NOT NULL,
  "opened_by_role_snapshot" TEXT NOT NULL,
  "device_id" UUID NOT NULL,
  "merged_into_order_id" UUID,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_table_assignments" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "table_id" UUID NOT NULL,
  "assigned_by_id" TEXT,
  "assigned_by_name_snapshot" TEXT NOT NULL,
  "assigned_by_role_snapshot" TEXT NOT NULL,
  "released_by_id" TEXT,
  "released_by_name_snapshot" TEXT,
  "released_by_role_snapshot" TEXT,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMP(3),
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "order_table_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "menu_item_id" TEXT,
  "item_name_snapshot" TEXT NOT NULL,
  "item_name_en_snapshot" TEXT,
  "unit_price_minor" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "line_total_minor" BIGINT NOT NULL,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_item_modifiers" (
  "id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "modifier_option_id" UUID,
  "group_name_snapshot" TEXT NOT NULL,
  "group_name_en_snapshot" TEXT,
  "option_name_snapshot" TEXT NOT NULL,
  "option_name_en_snapshot" TEXT,
  "price_type_snapshot" "ModifierPriceType" NOT NULL,
  "unit_price_minor" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "line_total_minor" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_discounts" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "type" "DiscountType" NOT NULL,
  "percentage_basis_points" INTEGER,
  "fixed_amount_minor" BIGINT,
  "calculated_amount_minor" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_name_snapshot" TEXT NOT NULL,
  "actor_role_snapshot" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_discounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "modifier_groups" (
  "id" UUID NOT NULL,
  "type" "ModifierGroupType" NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "min_selections" INTEGER NOT NULL DEFAULT 0,
  "max_selections" INTEGER NOT NULL DEFAULT 1,
  "is_required" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "modifier_options" (
  "id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "name_en" TEXT,
  "price_type" "ModifierPriceType" NOT NULL DEFAULT 'DELTA',
  "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "menu_item_modifier_groups" (
  "id" UUID NOT NULL,
  "menu_item_id" TEXT NOT NULL,
  "group_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "menu_item_modifier_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
  "id" UUID NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "currency_snapshot" TEXT NOT NULL DEFAULT 'ILS',
  "business_date" DATE NOT NULL,
  "subtotal_minor" BIGINT NOT NULL,
  "discount_minor" BIGINT NOT NULL DEFAULT 0,
  "total_minor" BIGINT NOT NULL,
  "refunded_minor" BIGINT NOT NULL DEFAULT 0,
  "cashier_id" TEXT,
  "cashier_name_snapshot" TEXT NOT NULL,
  "cashier_role_snapshot" TEXT NOT NULL,
  "device_id" UUID NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_orders" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_table_snapshots" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "table_id" UUID,
  "table_code_snapshot" TEXT NOT NULL,
  "table_display_name_snapshot" TEXT,
  "table_capacity_snapshot" INTEGER,
  CONSTRAINT "invoice_table_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_lines" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "order_item_id" UUID,
  "menu_item_id" TEXT,
  "item_name_snapshot" TEXT NOT NULL,
  "item_name_en_snapshot" TEXT,
  "unit_price_minor" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "subtotal_minor" BIGINT NOT NULL,
  "discount_minor" BIGINT NOT NULL DEFAULT 0,
  "total_minor" BIGINT NOT NULL,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_line_modifiers" (
  "id" UUID NOT NULL,
  "invoice_line_id" UUID NOT NULL,
  "modifier_option_id" UUID,
  "group_name_snapshot" TEXT NOT NULL,
  "group_name_en_snapshot" TEXT,
  "option_name_snapshot" TEXT NOT NULL,
  "option_name_en_snapshot" TEXT,
  "price_type_snapshot" "ModifierPriceType" NOT NULL,
  "unit_price_minor" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "total_minor" BIGINT NOT NULL,
  CONSTRAINT "invoice_line_modifiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_discounts" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "type" "DiscountType" NOT NULL,
  "percentage_basis_points" INTEGER,
  "fixed_amount_minor" BIGINT,
  "calculated_amount_minor" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_name_snapshot" TEXT NOT NULL,
  "actor_role_snapshot" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_discounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
  "amount_minor" BIGINT NOT NULL,
  "tendered_minor" BIGINT,
  "change_minor" BIGINT,
  "actor_id" TEXT,
  "actor_name_snapshot" TEXT NOT NULL,
  "actor_role_snapshot" TEXT NOT NULL,
  "device_id" UUID NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_voids" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_name_snapshot" TEXT NOT NULL,
  "actor_role_snapshot" TEXT NOT NULL,
  "device_id" UUID NOT NULL,
  "operation_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_voids_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refunds" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_name_snapshot" TEXT NOT NULL,
  "actor_role_snapshot" TEXT NOT NULL,
  "device_id" UUID NOT NULL,
  "operation_id" UUID,
  "refunded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_lines" (
  "id" UUID NOT NULL,
  "refund_id" UUID NOT NULL,
  "invoice_line_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  CONSTRAINT "refund_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refund_payments" (
  "id" UUID NOT NULL,
  "refund_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  CONSTRAINT "refund_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservations" (
  "id" UUID NOT NULL,
  "customer_name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "guest_count" INTEGER NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3),
  "notes" TEXT,
  "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "created_by_id" TEXT,
  "created_by_name_snapshot" TEXT NOT NULL,
  "created_by_role_snapshot" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reservation_tables" (
  "id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "table_id" UUID NOT NULL,
  "table_code_snapshot" TEXT NOT NULL,
  "table_display_name_snapshot" TEXT,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cashier_shifts" (
  "id" UUID NOT NULL,
  "user_id" TEXT,
  "user_name_snapshot" TEXT NOT NULL,
  "user_role_snapshot" TEXT NOT NULL,
  "device_id" UUID NOT NULL,
  "status" "CashierShiftStatus" NOT NULL DEFAULT 'OPEN',
  "business_date" DATE NOT NULL,
  "opening_cash_minor" BIGINT NOT NULL,
  "cash_sales_minor" BIGINT NOT NULL DEFAULT 0,
  "cash_refunds_minor" BIGINT NOT NULL DEFAULT 0,
  "expected_cash_minor" BIGINT NOT NULL DEFAULT 0,
  "actual_closing_cash_minor" BIGINT,
  "difference_minor" BIGINT,
  "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cashier_shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "receipt_print_events" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "device_id" UUID NOT NULL,
  "actor_id" TEXT,
  "actor_name_snapshot" TEXT NOT NULL,
  "actor_role_snapshot" TEXT NOT NULL,
  "type" "ReceiptPrintType" NOT NULL,
  "paper_width_mm" INTEGER NOT NULL,
  "profile_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_print_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_operations" (
  "operation_id" UUID NOT NULL,
  "device_id" UUID NOT NULL,
  "local_sequence" BIGINT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "operation_type" TEXT NOT NULL,
  "status" "SyncOperationStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "sync_operations_pkey" PRIMARY KEY ("operation_id")
);

-- Known lookup/report indexes and uniqueness constraints.
CREATE UNIQUE INDEX "pos_devices_code_key" ON "pos_devices"("code");
CREATE INDEX "pos_devices_is_active_idx" ON "pos_devices"("is_active");
CREATE UNIQUE INDEX "dining_tables_code_key" ON "dining_tables"("code");
CREATE INDEX "dining_tables_status_is_active_idx" ON "dining_tables"("status", "is_active");
CREATE INDEX "dining_tables_is_active_sort_order_idx" ON "dining_tables"("is_active", "sort_order");

CREATE INDEX "orders_status_business_date_idx" ON "orders"("status", "business_date");
CREATE INDEX "orders_business_date_opened_at_idx" ON "orders"("business_date", "opened_at");
CREATE INDEX "orders_device_id_status_idx" ON "orders"("device_id", "status");
CREATE INDEX "orders_opened_by_id_opened_at_idx" ON "orders"("opened_by_id", "opened_at");
CREATE INDEX "orders_merged_into_order_id_idx" ON "orders"("merged_into_order_id");
CREATE INDEX "order_table_assignments_order_id_released_at_idx" ON "order_table_assignments"("order_id", "released_at");
CREATE INDEX "order_table_assignments_table_id_released_at_idx" ON "order_table_assignments"("table_id", "released_at");
CREATE INDEX "order_table_assignments_assigned_by_id_idx" ON "order_table_assignments"("assigned_by_id");
CREATE INDEX "order_table_assignments_released_by_id_idx" ON "order_table_assignments"("released_by_id");
CREATE UNIQUE INDEX "order_table_assignments_one_active_table_key"
  ON "order_table_assignments"("table_id") WHERE "released_at" IS NULL;
CREATE UNIQUE INDEX "order_table_assignments_one_active_primary_key"
  ON "order_table_assignments"("order_id") WHERE "released_at" IS NULL AND "is_primary" = true;
CREATE INDEX "order_items_order_id_sort_order_idx" ON "order_items"("order_id", "sort_order");
CREATE INDEX "order_items_menu_item_id_idx" ON "order_items"("menu_item_id");
CREATE INDEX "order_item_modifiers_order_item_id_idx" ON "order_item_modifiers"("order_item_id");
CREATE INDEX "order_item_modifiers_modifier_option_id_idx" ON "order_item_modifiers"("modifier_option_id");
CREATE INDEX "order_discounts_order_id_created_at_idx" ON "order_discounts"("order_id", "created_at");
CREATE INDEX "order_discounts_actor_id_idx" ON "order_discounts"("actor_id");

CREATE INDEX "modifier_groups_is_active_sort_order_idx" ON "modifier_groups"("is_active", "sort_order");
CREATE INDEX "modifier_groups_type_is_active_idx" ON "modifier_groups"("type", "is_active");
CREATE INDEX "modifier_options_group_id_is_active_sort_order_idx" ON "modifier_options"("group_id", "is_active", "sort_order");
CREATE INDEX "menu_item_modifier_groups_group_id_idx" ON "menu_item_modifier_groups"("group_id");
CREATE UNIQUE INDEX "menu_item_modifier_groups_menu_item_id_group_id_key" ON "menu_item_modifier_groups"("menu_item_id", "group_id");

CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE INDEX "invoices_status_business_date_idx" ON "invoices"("status", "business_date");
CREATE INDEX "invoices_business_date_issued_at_idx" ON "invoices"("business_date", "issued_at");
CREATE INDEX "invoices_device_id_issued_at_idx" ON "invoices"("device_id", "issued_at");
CREATE INDEX "invoices_cashier_id_issued_at_idx" ON "invoices"("cashier_id", "issued_at");
CREATE INDEX "invoice_orders_order_id_idx" ON "invoice_orders"("order_id");
CREATE UNIQUE INDEX "invoice_orders_invoice_id_order_id_key" ON "invoice_orders"("invoice_id", "order_id");
CREATE INDEX "invoice_table_snapshots_invoice_id_idx" ON "invoice_table_snapshots"("invoice_id");
CREATE INDEX "invoice_table_snapshots_table_id_idx" ON "invoice_table_snapshots"("table_id");
CREATE INDEX "invoice_lines_invoice_id_sort_order_idx" ON "invoice_lines"("invoice_id", "sort_order");
CREATE INDEX "invoice_lines_order_item_id_idx" ON "invoice_lines"("order_item_id");
CREATE INDEX "invoice_lines_menu_item_id_idx" ON "invoice_lines"("menu_item_id");
CREATE INDEX "invoice_line_modifiers_invoice_line_id_idx" ON "invoice_line_modifiers"("invoice_line_id");
CREATE INDEX "invoice_line_modifiers_modifier_option_id_idx" ON "invoice_line_modifiers"("modifier_option_id");
CREATE INDEX "invoice_discounts_invoice_id_created_at_idx" ON "invoice_discounts"("invoice_id", "created_at");
CREATE INDEX "invoice_discounts_actor_id_idx" ON "invoice_discounts"("actor_id");
CREATE INDEX "payments_invoice_id_paid_at_idx" ON "payments"("invoice_id", "paid_at");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");
CREATE INDEX "payments_device_id_paid_at_idx" ON "payments"("device_id", "paid_at");
CREATE INDEX "payments_actor_id_idx" ON "payments"("actor_id");
CREATE UNIQUE INDEX "invoice_voids_invoice_id_key" ON "invoice_voids"("invoice_id");
CREATE INDEX "invoice_voids_actor_id_idx" ON "invoice_voids"("actor_id");
CREATE INDEX "invoice_voids_device_id_created_at_idx" ON "invoice_voids"("device_id", "created_at");
CREATE INDEX "invoice_voids_operation_id_idx" ON "invoice_voids"("operation_id");
CREATE INDEX "refunds_invoice_id_refunded_at_idx" ON "refunds"("invoice_id", "refunded_at");
CREATE INDEX "refunds_refunded_at_idx" ON "refunds"("refunded_at");
CREATE INDEX "refunds_device_id_refunded_at_idx" ON "refunds"("device_id", "refunded_at");
CREATE INDEX "refunds_actor_id_idx" ON "refunds"("actor_id");
CREATE INDEX "refunds_operation_id_idx" ON "refunds"("operation_id");
CREATE INDEX "refund_lines_invoice_line_id_idx" ON "refund_lines"("invoice_line_id");
CREATE UNIQUE INDEX "refund_lines_refund_id_invoice_line_id_key" ON "refund_lines"("refund_id", "invoice_line_id");
CREATE INDEX "refund_payments_payment_id_idx" ON "refund_payments"("payment_id");
CREATE UNIQUE INDEX "refund_payments_refund_id_payment_id_key" ON "refund_payments"("refund_id", "payment_id");

CREATE INDEX "reservations_status_starts_at_idx" ON "reservations"("status", "starts_at");
CREATE INDEX "reservations_starts_at_idx" ON "reservations"("starts_at");
CREATE INDEX "reservations_phone_idx" ON "reservations"("phone");
CREATE INDEX "reservations_created_by_id_idx" ON "reservations"("created_by_id");
CREATE INDEX "reservation_tables_table_id_idx" ON "reservation_tables"("table_id");
CREATE UNIQUE INDEX "reservation_tables_reservation_id_table_id_key" ON "reservation_tables"("reservation_id", "table_id");

CREATE INDEX "cashier_shifts_user_id_device_id_status_idx" ON "cashier_shifts"("user_id", "device_id", "status");
CREATE INDEX "cashier_shifts_business_date_status_idx" ON "cashier_shifts"("business_date", "status");
CREATE INDEX "cashier_shifts_device_id_opened_at_idx" ON "cashier_shifts"("device_id", "opened_at");
CREATE UNIQUE INDEX "cashier_shifts_one_open_user_device_key"
  ON "cashier_shifts"("user_id", "device_id") WHERE "status" = 'OPEN';

CREATE INDEX "receipt_print_events_invoice_id_created_at_idx" ON "receipt_print_events"("invoice_id", "created_at");
CREATE INDEX "receipt_print_events_device_id_created_at_idx" ON "receipt_print_events"("device_id", "created_at");
CREATE INDEX "receipt_print_events_actor_id_idx" ON "receipt_print_events"("actor_id");
CREATE INDEX "sync_operations_device_id_status_local_sequence_idx" ON "sync_operations"("device_id", "status", "local_sequence");
CREATE INDEX "sync_operations_status_created_at_idx" ON "sync_operations"("status", "created_at");
CREATE UNIQUE INDEX "sync_operations_device_id_local_sequence_key" ON "sync_operations"("device_id", "local_sequence");

-- Mutable identities/catalog records use SET NULL with required snapshots.
-- POS devices, tables, orders, and all financial parents use RESTRICT.
ALTER TABLE "orders" ADD CONSTRAINT "orders_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_merged_into_order_id_fkey" FOREIGN KEY ("merged_into_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_table_assignments" ADD CONSTRAINT "order_table_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_table_assignments" ADD CONSTRAINT "order_table_assignments_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_table_assignments" ADD CONSTRAINT "order_table_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_table_assignments" ADD CONSTRAINT "order_table_assignments_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_modifier_option_id_fkey" FOREIGN KEY ("modifier_option_id") REFERENCES "modifier_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_discounts" ADD CONSTRAINT "order_discounts_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_orders" ADD CONSTRAINT "invoice_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_orders" ADD CONSTRAINT "invoice_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_table_snapshots" ADD CONSTRAINT "invoice_table_snapshots_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_table_snapshots" ADD CONSTRAINT "invoice_table_snapshots_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_line_modifiers" ADD CONSTRAINT "invoice_line_modifiers_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_line_modifiers" ADD CONSTRAINT "invoice_line_modifiers_modifier_option_id_fkey" FOREIGN KEY ("modifier_option_id") REFERENCES "modifier_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_discounts" ADD CONSTRAINT "invoice_discounts_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_discounts" ADD CONSTRAINT "invoice_discounts_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_voids" ADD CONSTRAINT "invoice_voids_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_voids" ADD CONSTRAINT "invoice_voids_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_voids" ADD CONSTRAINT "invoice_voids_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_lines" ADD CONSTRAINT "refund_lines_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_lines" ADD CONSTRAINT "refund_lines_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_payments" ADD CONSTRAINT "refund_payments_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund_payments" ADD CONSTRAINT "refund_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cashier_shifts" ADD CONSTRAINT "cashier_shifts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_print_events" ADD CONSTRAINT "receipt_print_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_print_events" ADD CONSTRAINT "receipt_print_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_print_events" ADD CONSTRAINT "receipt_print_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sync_operations" ADD CONSTRAINT "sync_operations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "pos_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-field invariants not expressible in the Prisma schema.
ALTER TABLE "pos_devices"
  ADD CONSTRAINT "pos_devices_code_nonempty_check" CHECK (char_length(btrim("code")) > 0),
  ADD CONSTRAINT "pos_devices_name_nonempty_check" CHECK (char_length(btrim("name")) > 0);

ALTER TABLE "dining_tables"
  ADD CONSTRAINT "dining_tables_code_nonempty_check" CHECK (char_length(btrim("code")) > 0),
  ADD CONSTRAINT "dining_tables_capacity_positive_check" CHECK ("capacity" IS NULL OR "capacity" > 0),
  ADD CONSTRAINT "dining_tables_disabled_state_check" CHECK ("is_active" = ("status" <> 'DISABLED'));

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "orders_guest_count_positive_check" CHECK ("guest_count" IS NULL OR "guest_count" > 0),
  ADD CONSTRAINT "orders_merge_target_check" CHECK (
    ("status" = 'MERGED' AND "merged_into_order_id" IS NOT NULL AND "merged_into_order_id" <> "id") OR
    ("status" <> 'MERGED' AND "merged_into_order_id" IS NULL)
  ),
  ADD CONSTRAINT "orders_closed_state_check" CHECK (
    ("status" IN ('CLOSED', 'CANCELLED', 'MERGED') AND "closed_at" IS NOT NULL) OR
    ("status" IN ('OPEN', 'BILL_REQUESTED', 'PARTIALLY_BILLED') AND "closed_at" IS NULL)
  ),
  ADD CONSTRAINT "orders_closed_after_opened_check" CHECK ("closed_at" IS NULL OR "closed_at" >= "opened_at");

ALTER TABLE "order_table_assignments"
  ADD CONSTRAINT "order_table_assignments_release_check" CHECK (
    ("released_at" IS NULL AND "released_by_id" IS NULL AND "released_by_name_snapshot" IS NULL AND "released_by_role_snapshot" IS NULL) OR
    ("released_at" IS NOT NULL AND "released_by_name_snapshot" IS NOT NULL AND "released_by_role_snapshot" IS NOT NULL)
  ),
  ADD CONSTRAINT "order_table_assignments_release_time_check" CHECK ("released_at" IS NULL OR "released_at" >= "assigned_at");

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_items_money_nonnegative_check" CHECK ("unit_price_minor" >= 0 AND "line_total_minor" >= 0);

ALTER TABLE "order_item_modifiers"
  ADD CONSTRAINT "order_item_modifiers_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "order_item_modifiers_money_nonnegative_check" CHECK ("unit_price_minor" >= 0 AND "line_total_minor" >= 0);

ALTER TABLE "order_discounts"
  ADD CONSTRAINT "order_discounts_reason_nonempty_check" CHECK (char_length(btrim("reason")) > 0),
  ADD CONSTRAINT "order_discounts_amount_nonnegative_check" CHECK ("calculated_amount_minor" >= 0),
  ADD CONSTRAINT "order_discounts_requested_value_check" CHECK (
    ("type" = 'PERCENTAGE' AND "percentage_basis_points" IS NOT NULL AND
      "percentage_basis_points" BETWEEN 0 AND 10000 AND "fixed_amount_minor" IS NULL) OR
    ("type" = 'FIXED' AND "percentage_basis_points" IS NULL AND
      "fixed_amount_minor" IS NOT NULL AND "fixed_amount_minor" >= 0)
  );

ALTER TABLE "modifier_groups"
  ADD CONSTRAINT "modifier_groups_selection_range_check" CHECK (
    "min_selections" >= 0 AND "max_selections" >= "min_selections"
  ),
  ADD CONSTRAINT "modifier_groups_required_selection_check" CHECK (NOT "is_required" OR "min_selections" >= 1);

ALTER TABLE "modifier_options"
  ADD CONSTRAINT "modifier_options_price_nonnegative_check" CHECK ("price" >= 0);

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_currency_check" CHECK ("currency_snapshot" IN ('ILS', 'NIS')),
  ADD CONSTRAINT "invoices_money_check" CHECK (
    "subtotal_minor" >= 0 AND
    "discount_minor" >= 0 AND
    "discount_minor" <= "subtotal_minor" AND
    "total_minor" = "subtotal_minor" - "discount_minor" AND
    "refunded_minor" >= 0 AND
    "refunded_minor" <= "total_minor"
  ),
  ADD CONSTRAINT "invoices_paid_state_check" CHECK (
    "status" IN ('OPEN', 'VOIDED') OR "paid_at" IS NOT NULL
  );

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "invoice_lines_money_check" CHECK (
    "unit_price_minor" >= 0 AND
    "subtotal_minor" >= 0 AND
    "discount_minor" >= 0 AND
    "discount_minor" <= "subtotal_minor" AND
    "total_minor" = "subtotal_minor" - "discount_minor"
  );

ALTER TABLE "invoice_line_modifiers"
  ADD CONSTRAINT "invoice_line_modifiers_quantity_positive_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "invoice_line_modifiers_money_nonnegative_check" CHECK ("unit_price_minor" >= 0 AND "total_minor" >= 0);

ALTER TABLE "invoice_discounts"
  ADD CONSTRAINT "invoice_discounts_reason_nonempty_check" CHECK (char_length(btrim("reason")) > 0),
  ADD CONSTRAINT "invoice_discounts_amount_nonnegative_check" CHECK ("calculated_amount_minor" >= 0),
  ADD CONSTRAINT "invoice_discounts_requested_value_check" CHECK (
    ("type" = 'PERCENTAGE' AND "percentage_basis_points" IS NOT NULL AND
      "percentage_basis_points" BETWEEN 0 AND 10000 AND "fixed_amount_minor" IS NULL) OR
    ("type" = 'FIXED' AND "percentage_basis_points" IS NULL AND
      "fixed_amount_minor" IS NOT NULL AND "fixed_amount_minor" >= 0)
  );

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_positive_check" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "payments_cash_tender_check" CHECK (
    ("method" = 'VISA' AND "tendered_minor" IS NULL AND "change_minor" IS NULL) OR
    ("method" = 'CASH' AND "tendered_minor" IS NOT NULL AND "change_minor" IS NOT NULL AND
      "change_minor" >= 0 AND "tendered_minor" = "amount_minor" + "change_minor")
  );

ALTER TABLE "invoice_voids"
  ADD CONSTRAINT "invoice_voids_reason_nonempty_check" CHECK (char_length(btrim("reason")) > 0);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_positive_check" CHECK ("amount_minor" > 0),
  ADD CONSTRAINT "refunds_reason_nonempty_check" CHECK (char_length(btrim("reason")) > 0);

ALTER TABLE "refund_lines"
  ADD CONSTRAINT "refund_lines_values_positive_check" CHECK ("quantity" > 0 AND "amount_minor" > 0);

ALTER TABLE "refund_payments"
  ADD CONSTRAINT "refund_payments_amount_positive_check" CHECK ("amount_minor" > 0);

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_guest_count_positive_check" CHECK ("guest_count" > 0),
  ADD CONSTRAINT "reservations_version_positive_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "reservations_time_range_check" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

ALTER TABLE "cashier_shifts"
  ADD CONSTRAINT "cashier_shifts_money_nonnegative_check" CHECK (
    "opening_cash_minor" >= 0 AND "cash_sales_minor" >= 0 AND
    "cash_refunds_minor" >= 0 AND "expected_cash_minor" >= 0 AND
    ("actual_closing_cash_minor" IS NULL OR "actual_closing_cash_minor" >= 0)
  ),
  ADD CONSTRAINT "cashier_shifts_state_check" CHECK (
    ("status" = 'OPEN' AND "closed_at" IS NULL AND "actual_closing_cash_minor" IS NULL AND "difference_minor" IS NULL) OR
    ("status" = 'CLOSED' AND "closed_at" IS NOT NULL AND "actual_closing_cash_minor" IS NOT NULL AND "difference_minor" IS NOT NULL)
  ),
  ADD CONSTRAINT "cashier_shifts_close_time_check" CHECK ("closed_at" IS NULL OR "closed_at" >= "opened_at");

ALTER TABLE "receipt_print_events"
  ADD CONSTRAINT "receipt_print_events_paper_width_positive_check" CHECK ("paper_width_mm" > 0);

ALTER TABLE "sync_operations"
  ADD CONSTRAINT "sync_operations_sequence_nonnegative_check" CHECK ("local_sequence" >= 0),
  ADD CONSTRAINT "sync_operations_request_hash_nonempty_check" CHECK (char_length(btrim("request_hash")) > 0),
  ADD CONSTRAINT "sync_operations_type_nonempty_check" CHECK (char_length(btrim("operation_type")) > 0),
  ADD CONSTRAINT "sync_operations_processed_state_check" CHECK (
    ("status" IN ('SUCCEEDED', 'FAILED', 'CONFLICT') AND "processed_at" IS NOT NULL) OR
    ("status" IN ('PENDING', 'PROCESSING') AND "processed_at" IS NULL)
  );

-- Final financial snapshots/audits are append-only; aggregate rows that must
-- transition status remain updateable but cannot be physically deleted.
CREATE FUNCTION "prevent_pos_financial_delete"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'physical deletion from % is forbidden', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE FUNCTION "prevent_pos_append_only_change"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

-- Append-only snapshot rows may still lose a nullable pointer when the mutable
-- legacy source row is deleted. All snapshot/fact columns remain unchanged.
CREATE FUNCTION "prevent_pos_append_only_except_reference_unlink"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  reference_column TEXT := TG_ARGV[0];
BEGIN
  IF TG_OP = 'UPDATE'
    AND to_jsonb(OLD) -> reference_column <> 'null'::jsonb
    AND to_jsonb(NEW) -> reference_column = 'null'::jsonb
    AND (to_jsonb(OLD) - reference_column) = (to_jsonb(NEW) - reference_column)
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% rows are append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER "orders_no_delete" BEFORE DELETE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_financial_delete"();
CREATE TRIGGER "invoices_no_delete" BEFORE DELETE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_financial_delete"();
CREATE TRIGGER "payments_no_delete" BEFORE DELETE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_financial_delete"();
CREATE TRIGGER "cashier_shifts_no_delete" BEFORE DELETE ON "cashier_shifts"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_financial_delete"();

CREATE TRIGGER "order_discounts_append_only" BEFORE UPDATE OR DELETE ON "order_discounts"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('actor_id');
CREATE TRIGGER "invoice_orders_append_only" BEFORE UPDATE OR DELETE ON "invoice_orders"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_change"();
CREATE TRIGGER "invoice_table_snapshots_append_only" BEFORE UPDATE OR DELETE ON "invoice_table_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_change"();
CREATE TRIGGER "invoice_lines_append_only" BEFORE UPDATE OR DELETE ON "invoice_lines"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('menu_item_id');
CREATE TRIGGER "invoice_line_modifiers_append_only" BEFORE UPDATE OR DELETE ON "invoice_line_modifiers"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('modifier_option_id');
CREATE TRIGGER "invoice_discounts_append_only" BEFORE UPDATE OR DELETE ON "invoice_discounts"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('actor_id');
CREATE TRIGGER "invoice_voids_append_only" BEFORE UPDATE OR DELETE ON "invoice_voids"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('actor_id');
CREATE TRIGGER "refunds_append_only" BEFORE UPDATE OR DELETE ON "refunds"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('actor_id');
CREATE TRIGGER "refund_lines_append_only" BEFORE UPDATE OR DELETE ON "refund_lines"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_change"();
CREATE TRIGGER "refund_payments_append_only" BEFORE UPDATE OR DELETE ON "refund_payments"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_change"();
CREATE TRIGGER "receipt_print_events_append_only" BEFORE UPDATE OR DELETE ON "receipt_print_events"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('actor_id');

-- Migration 6: additive, exact equal-bill allocation ledger.
-- Existing invoice_lines remain unchanged and keep their positive integer
-- quantity contract. Split invoices use immutable rational allocation rows.

CREATE TYPE "InvoiceSplitMode" AS ENUM ('ITEM', 'EQUAL');

ALTER TABLE "invoices"
  ADD COLUMN "split_group_id" UUID,
  ADD COLUMN "split_mode" "InvoiceSplitMode",
  ADD COLUMN "split_index" INTEGER,
  ADD COLUMN "split_count" INTEGER;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_split_metadata_check" CHECK (
    ("split_group_id" IS NULL AND "split_mode" IS NULL AND "split_index" IS NULL AND "split_count" IS NULL) OR
    ("split_group_id" IS NOT NULL AND "split_mode" IS NOT NULL AND
      "split_count" >= 2 AND "split_index" BETWEEN 1 AND "split_count")
  );

CREATE UNIQUE INDEX "invoices_split_group_id_split_index_key"
  ON "invoices"("split_group_id", "split_index");
CREATE INDEX "invoices_split_group_id_idx" ON "invoices"("split_group_id");

CREATE TABLE "invoice_allocation_lines" (
  "id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "menu_item_id" TEXT,
  "item_name_snapshot" TEXT NOT NULL,
  "item_name_en_snapshot" TEXT,
  "unit_price_minor" BIGINT NOT NULL,
  "quantity_numerator" BIGINT NOT NULL,
  "quantity_denominator" BIGINT NOT NULL,
  "subtotal_minor" BIGINT NOT NULL,
  "discount_minor" BIGINT NOT NULL DEFAULT 0,
  "total_minor" BIGINT NOT NULL,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_allocation_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_allocation_lines_quantity_check" CHECK (
    "quantity_numerator" > 0 AND "quantity_denominator" > 0
  ),
  CONSTRAINT "invoice_allocation_lines_money_check" CHECK (
    "unit_price_minor" >= 0 AND "subtotal_minor" >= 0 AND
    "discount_minor" >= 0 AND "discount_minor" <= "subtotal_minor" AND
    "total_minor" = "subtotal_minor" - "discount_minor"
  )
);

CREATE TABLE "invoice_allocation_line_modifiers" (
  "id" UUID NOT NULL,
  "invoice_allocation_line_id" UUID NOT NULL,
  "modifier_option_id" UUID,
  "group_name_snapshot" TEXT NOT NULL,
  "group_name_en_snapshot" TEXT,
  "option_name_snapshot" TEXT NOT NULL,
  "option_name_en_snapshot" TEXT,
  "price_type_snapshot" "ModifierPriceType" NOT NULL,
  "unit_price_minor" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "total_minor" BIGINT NOT NULL,
  CONSTRAINT "invoice_allocation_line_modifiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_allocation_line_modifiers_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "invoice_allocation_line_modifiers_money_check" CHECK (
    "unit_price_minor" >= 0 AND "total_minor" >= 0
  )
);

CREATE UNIQUE INDEX "invoice_allocation_lines_invoice_id_order_item_id_key"
  ON "invoice_allocation_lines"("invoice_id", "order_item_id");
CREATE INDEX "invoice_allocation_lines_invoice_id_sort_order_idx"
  ON "invoice_allocation_lines"("invoice_id", "sort_order");
CREATE INDEX "invoice_allocation_lines_order_item_id_idx"
  ON "invoice_allocation_lines"("order_item_id");
CREATE INDEX "invoice_allocation_lines_menu_item_id_idx"
  ON "invoice_allocation_lines"("menu_item_id");
CREATE INDEX "invoice_allocation_line_modifiers_invoice_allocation_line_id_idx"
  ON "invoice_allocation_line_modifiers"("invoice_allocation_line_id");
CREATE INDEX "invoice_allocation_line_modifiers_modifier_option_id_idx"
  ON "invoice_allocation_line_modifiers"("modifier_option_id");

ALTER TABLE "invoice_allocation_lines"
  ADD CONSTRAINT "invoice_allocation_lines_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "invoice_allocation_lines_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "invoice_allocation_lines_menu_item_id_fkey"
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoice_allocation_line_modifiers"
  ADD CONSTRAINT "invoice_allocation_line_modifiers_invoice_allocation_line_id_fkey"
  FOREIGN KEY ("invoice_allocation_line_id") REFERENCES "invoice_allocation_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "invoice_allocation_line_modifiers_modifier_option_id_fkey"
  FOREIGN KEY ("modifier_option_id") REFERENCES "modifier_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER "invoice_allocation_lines_append_only"
  BEFORE UPDATE OR DELETE ON "invoice_allocation_lines"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('menu_item_id');

CREATE TRIGGER "invoice_allocation_line_modifiers_append_only"
  BEFORE UPDATE OR DELETE ON "invoice_allocation_line_modifiers"
  FOR EACH ROW EXECUTE FUNCTION "prevent_pos_append_only_except_reference_unlink"('modifier_option_id');

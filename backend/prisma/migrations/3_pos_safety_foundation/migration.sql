-- Phase 1: additive POS safety foundation only. No transactional POS models.

-- Extend existing roles without changing SUPER_ADMIN/MANAGER/STAFF semantics.
ALTER TYPE "AdminRole" ADD VALUE 'CASHIER';

-- Reserve explicit action names for future transactional financial audits.
ALTER TYPE "ActivityAction" ADD VALUE 'ORDER_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'ORDER_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE 'ORDER_CANCELLED';
ALTER TYPE "ActivityAction" ADD VALUE 'TABLE_TRANSFERRED';
ALTER TYPE "ActivityAction" ADD VALUE 'TABLES_MERGED';
ALTER TYPE "ActivityAction" ADD VALUE 'DISCOUNT_APPLIED';
ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_VOIDED';
ALTER TYPE "ActivityAction" ADD VALUE 'REFUND_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE 'SHIFT_OPENED';
ALTER TYPE "ActivityAction" ADD VALUE 'SHIFT_CLOSED';
ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_PRINTED';
ALTER TYPE "ActivityAction" ADD VALUE 'INVOICE_REPRINTED';
ALTER TYPE "ActivityAction" ADD VALUE 'POS_SYNC_APPLIED';

CREATE TYPE "CatalogChangeAction" AS ENUM ('CREATED', 'UPDATED', 'DEACTIVATED', 'RESTORED', 'DELETED');

-- Restaurant business-clock/POS configuration. Existing Rawaqan EGP defaults
-- are intentionally moved to the confirmed ILS configuration.
ALTER TABLE "restaurant_settings"
  ALTER COLUMN "currency" SET DEFAULT 'ILS',
  ADD COLUMN "pos_currency" TEXT NOT NULL DEFAULT 'ILS',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Hebron',
  ADD COLUMN "business_day_cutoff" TEXT NOT NULL DEFAULT '04:00';

UPDATE "restaurant_settings" SET "currency" = 'ILS' WHERE "currency" = 'EGP';

-- Snapshot/context columns are nullable so every historical audit row remains valid.
ALTER TABLE "activity_logs"
  ADD COLUMN "actor_name_snapshot" TEXT,
  ADD COLUMN "actor_role_snapshot" TEXT,
  ADD COLUMN "operation_id" TEXT,
  ADD COLUMN "device_id" TEXT,
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "before_data" JSONB,
  ADD COLUMN "after_data" JSONB;

CREATE INDEX "activity_logs_operation_id_idx" ON "activity_logs"("operation_id");
CREATE INDEX "activity_logs_device_id_idx" ON "activity_logs"("device_id");

-- Revision is a monotonic global catalog cursor. Rows are append-only and
-- double as tombstones after a source entity is deleted or deactivated.
CREATE TABLE "catalog_changes" (
  "revision" BIGSERIAL NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" "CatalogChangeAction" NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_changes_pkey" PRIMARY KEY ("revision")
);

CREATE INDEX "catalog_changes_entity_type_entity_id_idx"
  ON "catalog_changes"("entity_type", "entity_id");
CREATE INDEX "catalog_changes_created_at_idx" ON "catalog_changes"("created_at");

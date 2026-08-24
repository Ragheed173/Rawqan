-- Additive application-layer support for offline PIN re-authentication and
-- explicit POS audit actions. No financial facts or legacy identifiers change.
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'PAYMENT_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DEVICE_PAIRED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'DEVICE_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'RESERVATION_CREATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'RESERVATION_UPDATED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'RESERVATION_CANCELLED';

ALTER TABLE "admins" ADD COLUMN "pos_pin_hash" TEXT;

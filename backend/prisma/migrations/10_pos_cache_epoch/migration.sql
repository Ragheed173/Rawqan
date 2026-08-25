-- Tell paired POS browsers that the authoritative transactional dataset was
-- intentionally reset by migration 9. Each browser applies this epoch once,
-- without touching any device that still has unfinished offline operations.
ALTER TABLE "restaurant_settings"
ADD COLUMN "pos_cache_epoch" INTEGER NOT NULL DEFAULT 0;

UPDATE "restaurant_settings"
SET "pos_cache_epoch" = 1;

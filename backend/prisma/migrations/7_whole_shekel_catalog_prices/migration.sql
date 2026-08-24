-- Normalize catalog prices to the nearest whole shekel. Historical order and
-- invoice snapshots remain unchanged so completed financial records stay exact.
WITH "normalized" AS (
  SELECT
    "id",
    ROUND("price", 0) AS "price",
    CASE
      WHEN "discount_price" IS NULL THEN NULL
      WHEN ROUND("price", 0) <= 0 THEN NULL
      WHEN ROUND("discount_price", 0) >= ROUND("price", 0) THEN NULL
      ELSE ROUND("discount_price", 0)
    END AS "discount_price"
  FROM "menu_items"
),
"updated" AS (
  UPDATE "menu_items" AS "item"
  SET
    "price" = "normalized"."price",
    "discount_price" = "normalized"."discount_price",
    "updated_at" = CURRENT_TIMESTAMP
  FROM "normalized"
  WHERE "item"."id" = "normalized"."id"
    AND (
      "item"."price" IS DISTINCT FROM "normalized"."price"
      OR "item"."discount_price" IS DISTINCT FROM "normalized"."discount_price"
    )
  RETURNING "item"."id"
)
INSERT INTO "catalog_changes" ("entity_type", "entity_id", "action", "payload", "created_at")
SELECT
  'MenuItem',
  "id",
  'UPDATED',
  '{"reason":"WHOLE_SHEKEL_PRICE_MIGRATION"}'::jsonb,
  CURRENT_TIMESTAMP
FROM "updated";

WITH "updated" AS (
  UPDATE "modifier_options"
  SET
    "price" = ROUND("price", 0),
    "updated_at" = CURRENT_TIMESTAMP
  WHERE "price" IS DISTINCT FROM ROUND("price", 0)
  RETURNING "id", "group_id"
)
INSERT INTO "catalog_changes" ("entity_type", "entity_id", "action", "payload", "created_at")
SELECT
  'ModifierOption',
  "id"::text,
  'UPDATED',
  jsonb_build_object(
    'groupId', "group_id"::text,
    'reason', 'WHOLE_SHEKEL_PRICE_MIGRATION'
  ),
  CURRENT_TIMESTAMP
FROM "updated";

-- Keep Decimal columns for Prisma compatibility while enforcing whole values
-- at the database boundary as a final safeguard against bypassed API checks.
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_price_whole_shekel_check"
    CHECK ("price" = ROUND("price", 0)),
  ADD CONSTRAINT "menu_items_discount_price_whole_shekel_check"
    CHECK ("discount_price" IS NULL OR "discount_price" = ROUND("discount_price", 0));

ALTER TABLE "modifier_options"
  ADD CONSTRAINT "modifier_options_price_whole_shekel_check"
    CHECK ("price" = ROUND("price", 0));

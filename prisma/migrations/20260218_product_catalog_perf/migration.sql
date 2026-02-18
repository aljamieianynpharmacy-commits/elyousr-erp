BEGIN;

ALTER TABLE "Product"
  ALTER COLUMN "basePrice" TYPE DECIMAL(12,2) USING ROUND(COALESCE("basePrice", 0)::numeric, 2),
  ALTER COLUMN "basePrice" SET DEFAULT 0,
  ALTER COLUMN "cost" TYPE DECIMAL(12,2) USING CASE
    WHEN "cost" IS NULL THEN NULL
    ELSE ROUND("cost"::numeric, 2)
  END;

ALTER TABLE "Variant"
  ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2),
  ALTER COLUMN "cost" TYPE DECIMAL(12,2) USING ROUND("cost"::numeric, 2);

WITH duplicate_map AS (
  SELECT
    "id" AS duplicate_id,
    MIN("id") OVER (PARTITION BY "productId", "productSize", "color") AS keeper_id
  FROM "Variant"
),
to_merge AS (
  SELECT duplicate_id, keeper_id
  FROM duplicate_map
  WHERE duplicate_id <> keeper_id
),
qty_rollup AS (
  SELECT tm.keeper_id, COALESCE(SUM(v."quantity"), 0) AS qty_sum
  FROM to_merge tm
  JOIN "Variant" v ON v."id" = tm.duplicate_id
  GROUP BY tm.keeper_id
),
barcode_rollup AS (
  SELECT DISTINCT ON (tm.keeper_id)
    tm.keeper_id,
    v."barcode" AS barcode_value
  FROM to_merge tm
  JOIN "Variant" v ON v."id" = tm.duplicate_id
  WHERE v."barcode" IS NOT NULL
  ORDER BY tm.keeper_id, v."id" ASC
)
UPDATE "Variant" keeper
SET
  "quantity" = keeper."quantity" + COALESCE(q.qty_sum, 0),
  "barcode" = COALESCE(keeper."barcode", b.barcode_value),
  "updatedAt" = NOW()
FROM qty_rollup q
LEFT JOIN barcode_rollup b ON b.keeper_id = q.keeper_id
WHERE keeper."id" = q.keeper_id;

WITH duplicate_map AS (
  SELECT
    "id" AS duplicate_id,
    MIN("id") OVER (PARTITION BY "productId", "productSize", "color") AS keeper_id
  FROM "Variant"
),
to_merge AS (
  SELECT duplicate_id, keeper_id
  FROM duplicate_map
  WHERE duplicate_id <> keeper_id
)
UPDATE "SaleItem" si
SET "variantId" = tm.keeper_id
FROM to_merge tm
WHERE si."variantId" = tm.duplicate_id;

WITH duplicate_map AS (
  SELECT
    "id" AS duplicate_id,
    MIN("id") OVER (PARTITION BY "productId", "productSize", "color") AS keeper_id
  FROM "Variant"
),
to_merge AS (
  SELECT duplicate_id, keeper_id
  FROM duplicate_map
  WHERE duplicate_id <> keeper_id
)
UPDATE "PurchaseItem" pi
SET "variantId" = tm.keeper_id
FROM to_merge tm
WHERE pi."variantId" = tm.duplicate_id;

WITH duplicate_map AS (
  SELECT
    "id" AS duplicate_id,
    MIN("id") OVER (PARTITION BY "productId", "productSize", "color") AS keeper_id
  FROM "Variant"
),
to_merge AS (
  SELECT duplicate_id, keeper_id
  FROM duplicate_map
  WHERE duplicate_id <> keeper_id
)
UPDATE "ReturnItem" ri
SET "variantId" = tm.keeper_id
FROM to_merge tm
WHERE ri."variantId" = tm.duplicate_id;

WITH duplicate_map AS (
  SELECT
    "id" AS duplicate_id,
    MIN("id") OVER (PARTITION BY "productId", "productSize", "color") AS keeper_id
  FROM "Variant"
),
to_merge AS (
  SELECT duplicate_id, keeper_id
  FROM duplicate_map
  WHERE duplicate_id <> keeper_id
)
DELETE FROM "Variant" v
USING to_merge tm
WHERE v."id" = tm.duplicate_id;

CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "Product"("name");
CREATE INDEX IF NOT EXISTS "Product_categoryId_updatedAt_idx" ON "Product"("categoryId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Variant_productId_idx" ON "Variant"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "Variant_productId_productSize_color_key" ON "Variant"("productId", "productSize", "color");

COMMIT;

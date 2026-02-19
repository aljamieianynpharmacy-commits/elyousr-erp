BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_name_lower_pattern_idx"
  ON "Product" (LOWER("name") text_pattern_ops);

CREATE INDEX IF NOT EXISTS "Product_sku_lower_pattern_idx"
  ON "Product" (LOWER("sku") text_pattern_ops);

CREATE INDEX IF NOT EXISTS "Product_barcode_pattern_idx"
  ON "Product" ("barcode" text_pattern_ops);

CREATE INDEX IF NOT EXISTS "ProductUnit_barcode_pattern_idx"
  ON "ProductUnit" ("barcode" text_pattern_ops);

CREATE INDEX IF NOT EXISTS "Inventory_totalQuantity_idx"
  ON "Inventory" ("totalQuantity");

CREATE INDEX IF NOT EXISTS "Inventory_minStock_idx"
  ON "Inventory" ("minStock");

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING GIN (LOWER("name") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Product_sku_trgm_idx"
  ON "Product" USING GIN (LOWER("sku") gin_trgm_ops);

COMMIT;

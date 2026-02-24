-- Convert products to single-unit fields and remove ProductUnit table.

ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "unitName" TEXT NOT NULL DEFAULT 'قطعة',
    ADD COLUMN IF NOT EXISTS "wholesalePrice" DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "minSalePrice" DECIMAL(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'ProductUnit'
    ) THEN
        UPDATE "Product" p
        SET
            "unitName" = COALESCE(NULLIF(u."unitName", ''), p."unitName"),
            "basePrice" = COALESCE(u."salePrice", p."basePrice"),
            "cost" = COALESCE(u."purchasePrice", p."cost"),
            "barcode" = COALESCE(NULLIF(u."barcode", ''), p."barcode"),
            "wholesalePrice" = COALESCE(u."wholesalePrice", p."wholesalePrice"),
            "minSalePrice" = COALESCE(u."minSalePrice", p."minSalePrice")
        FROM (
            SELECT DISTINCT ON ("productId")
                "productId",
                "unitName",
                "salePrice",
                "purchasePrice",
                "barcode",
                "wholesalePrice",
                "minSalePrice"
            FROM "ProductUnit"
            ORDER BY "productId", CASE WHEN "conversionFactor" = 1 THEN 0 ELSE 1 END, "id" ASC
        ) u
        WHERE p."id" = u."productId";
    END IF;
END $$;

UPDATE "Product"
SET "unitName" = 'قطعة'
WHERE COALESCE(BTRIM("unitName"), '') = '';

UPDATE "Product"
SET "wholesalePrice" = "basePrice"
WHERE "wholesalePrice" <= 0;

UPDATE "Product"
SET "minSalePrice" = LEAST("wholesalePrice", "basePrice")
WHERE "minSalePrice" <= 0
   OR "minSalePrice" > "wholesalePrice";

DROP TABLE IF EXISTS "ProductUnit";

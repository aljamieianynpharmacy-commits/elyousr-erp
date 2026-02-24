-- Adds per-variant warehouse stock tracking and links warehouse transfers to variants.

CREATE TABLE IF NOT EXISTS "VariantWarehouseStock" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VariantWarehouseStock_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WarehouseTransfer"
    ADD COLUMN IF NOT EXISTS "variantId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "VariantWarehouseStock_variantId_warehouseId_key"
ON "VariantWarehouseStock"("variantId", "warehouseId");

CREATE INDEX IF NOT EXISTS "VariantWarehouseStock_variantId_idx"
ON "VariantWarehouseStock"("variantId");

CREATE INDEX IF NOT EXISTS "VariantWarehouseStock_warehouseId_idx"
ON "VariantWarehouseStock"("warehouseId");

CREATE INDEX IF NOT EXISTS "VariantWarehouseStock_warehouseId_variantId_idx"
ON "VariantWarehouseStock"("warehouseId", "variantId");

CREATE INDEX IF NOT EXISTS "WarehouseTransfer_variantId_idx"
ON "WarehouseTransfer"("variantId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'VariantWarehouseStock_variantId_fkey'
    ) THEN
        ALTER TABLE "VariantWarehouseStock"
        ADD CONSTRAINT "VariantWarehouseStock_variantId_fkey"
        FOREIGN KEY ("variantId")
        REFERENCES "Variant"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'VariantWarehouseStock_warehouseId_fkey'
    ) THEN
        ALTER TABLE "VariantWarehouseStock"
        ADD CONSTRAINT "VariantWarehouseStock_warehouseId_fkey"
        FOREIGN KEY ("warehouseId")
        REFERENCES "Warehouse"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'WarehouseTransfer_variantId_fkey'
    ) THEN
        ALTER TABLE "WarehouseTransfer"
        ADD CONSTRAINT "WarehouseTransfer_variantId_fkey"
        FOREIGN KEY ("variantId")
        REFERENCES "Variant"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
DECLARE
    ws RECORD;
    vr RECORD;
    first_variant_id INTEGER;
    remaining INTEGER;
    allocation INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM "WarehouseStock" LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM "VariantWarehouseStock" LIMIT 1)
    THEN
        FOR ws IN
            SELECT "productId", "warehouseId", GREATEST("quantity", 0) AS quantity
            FROM "WarehouseStock"
            WHERE GREATEST("quantity", 0) > 0
            ORDER BY "productId", "warehouseId"
        LOOP
            remaining := ws.quantity;

            FOR vr IN
                SELECT "id", GREATEST("quantity", 0) AS quantity
                FROM "Variant"
                WHERE "productId" = ws."productId"
                ORDER BY "id" ASC
            LOOP
                EXIT WHEN remaining <= 0;
                allocation := LEAST(remaining, vr.quantity);

                IF allocation > 0 THEN
                    INSERT INTO "VariantWarehouseStock" ("variantId", "warehouseId", "quantity")
                    VALUES (vr."id", ws."warehouseId", allocation)
                    ON CONFLICT ("variantId", "warehouseId") DO UPDATE
                    SET "quantity" = "VariantWarehouseStock"."quantity" + EXCLUDED."quantity",
                        "updatedAt" = CURRENT_TIMESTAMP;

                    remaining := remaining - allocation;
                END IF;
            END LOOP;

            IF remaining > 0 THEN
                SELECT "id" INTO first_variant_id
                FROM "Variant"
                WHERE "productId" = ws."productId"
                ORDER BY "id" ASC
                LIMIT 1;

                IF first_variant_id IS NOT NULL THEN
                    INSERT INTO "VariantWarehouseStock" ("variantId", "warehouseId", "quantity")
                    VALUES (first_variant_id, ws."warehouseId", remaining)
                    ON CONFLICT ("variantId", "warehouseId") DO UPDATE
                    SET "quantity" = "VariantWarehouseStock"."quantity" + EXCLUDED."quantity",
                        "updatedAt" = CURRENT_TIMESTAMP;
                END IF;
            END IF;
        END LOOP;
    END IF;
END $$;

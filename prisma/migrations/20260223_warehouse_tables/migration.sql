-- Adds warehouse tables used by Product/Warehouse stock features.
-- Safe for databases where these tables already exist.

CREATE TABLE IF NOT EXISTS "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WarehouseStock" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WarehouseTransfer" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "fromWarehouseId" INTEGER NOT NULL,
    "toWarehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_name_key" ON "Warehouse"("name");
CREATE INDEX IF NOT EXISTS "Warehouse_isActive_idx" ON "Warehouse"("isActive");
CREATE INDEX IF NOT EXISTS "Warehouse_name_idx" ON "Warehouse"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseStock_productId_warehouseId_key"
ON "WarehouseStock"("productId", "warehouseId");
CREATE INDEX IF NOT EXISTS "WarehouseStock_productId_idx" ON "WarehouseStock"("productId");
CREATE INDEX IF NOT EXISTS "WarehouseStock_warehouseId_idx" ON "WarehouseStock"("warehouseId");
CREATE INDEX IF NOT EXISTS "WarehouseStock_warehouseId_productId_idx"
ON "WarehouseStock"("warehouseId", "productId");

CREATE INDEX IF NOT EXISTS "WarehouseTransfer_productId_idx" ON "WarehouseTransfer"("productId");
CREATE INDEX IF NOT EXISTS "WarehouseTransfer_fromWarehouseId_idx" ON "WarehouseTransfer"("fromWarehouseId");
CREATE INDEX IF NOT EXISTS "WarehouseTransfer_toWarehouseId_idx" ON "WarehouseTransfer"("toWarehouseId");
CREATE INDEX IF NOT EXISTS "WarehouseTransfer_createdAt_idx" ON "WarehouseTransfer"("createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'WarehouseStock_productId_fkey'
    ) THEN
        ALTER TABLE "WarehouseStock"
        ADD CONSTRAINT "WarehouseStock_productId_fkey"
        FOREIGN KEY ("productId")
        REFERENCES "Product"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'WarehouseStock_warehouseId_fkey'
    ) THEN
        ALTER TABLE "WarehouseStock"
        ADD CONSTRAINT "WarehouseStock_warehouseId_fkey"
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
        WHERE conname = 'WarehouseTransfer_productId_fkey'
    ) THEN
        ALTER TABLE "WarehouseTransfer"
        ADD CONSTRAINT "WarehouseTransfer_productId_fkey"
        FOREIGN KEY ("productId")
        REFERENCES "Product"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'WarehouseTransfer_fromWarehouseId_fkey'
    ) THEN
        ALTER TABLE "WarehouseTransfer"
        ADD CONSTRAINT "WarehouseTransfer_fromWarehouseId_fkey"
        FOREIGN KEY ("fromWarehouseId")
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
        WHERE conname = 'WarehouseTransfer_toWarehouseId_fkey'
    ) THEN
        ALTER TABLE "WarehouseTransfer"
        ADD CONSTRAINT "WarehouseTransfer_toWarehouseId_fkey"
        FOREIGN KEY ("toWarehouseId")
        REFERENCES "Warehouse"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

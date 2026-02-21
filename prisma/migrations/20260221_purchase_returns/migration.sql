BEGIN;

CREATE TABLE IF NOT EXISTS "PurchaseReturn" (
    "id" SERIAL NOT NULL,
    "purchaseId" INTEGER,
    "supplierId" INTEGER,
    "total" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseReturnItem" (
    "id" INTEGER NOT NULL,
    "purchaseReturnId" INTEGER NOT NULL,
    "variantId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "PurchaseReturnItem_pkey" PRIMARY KEY ("id", "purchaseReturnId")
);

CREATE INDEX IF NOT EXISTS "PurchaseReturn_purchaseId_idx"
    ON "PurchaseReturn"("purchaseId");

CREATE INDEX IF NOT EXISTS "PurchaseReturn_supplierId_idx"
    ON "PurchaseReturn"("supplierId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'PurchaseReturn_purchaseId_fkey'
    ) THEN
        ALTER TABLE "PurchaseReturn"
            ADD CONSTRAINT "PurchaseReturn_purchaseId_fkey"
            FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'PurchaseReturn_supplierId_fkey'
    ) THEN
        ALTER TABLE "PurchaseReturn"
            ADD CONSTRAINT "PurchaseReturn_supplierId_fkey"
            FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'PurchaseReturnItem_purchaseReturnId_fkey'
    ) THEN
        ALTER TABLE "PurchaseReturnItem"
            ADD CONSTRAINT "PurchaseReturnItem_purchaseReturnId_fkey"
            FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'PurchaseReturnItem_variantId_fkey'
    ) THEN
        ALTER TABLE "PurchaseReturnItem"
            ADD CONSTRAINT "PurchaseReturnItem_variantId_fkey"
            FOREIGN KEY ("variantId") REFERENCES "Variant"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

COMMIT;

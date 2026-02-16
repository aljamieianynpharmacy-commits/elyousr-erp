DO $$
BEGIN
  CREATE TYPE "TreasuryDirection" AS ENUM ('IN', 'OUT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TreasuryEntryType" AS ENUM (
    'OPENING_BALANCE',
    'SALE_INCOME',
    'CUSTOMER_PAYMENT',
    'MANUAL_IN',
    'EXPENSE_PAYMENT',
    'PURCHASE_PAYMENT',
    'SUPPLIER_PAYMENT',
    'RETURN_REFUND',
    'MANUAL_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Treasury" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Treasury_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TreasuryEntry" (
  "id" SERIAL NOT NULL,
  "treasuryId" INTEGER NOT NULL,
  "entryType" "TreasuryEntryType" NOT NULL,
  "direction" "TreasuryDirection" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "balanceBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balanceAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "referenceType" TEXT,
  "referenceId" INTEGER,
  "paymentMethodId" INTEGER,
  "sourceTreasuryId" INTEGER,
  "targetTreasuryId" INTEGER,
  "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Treasury_name_key" ON "Treasury"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Treasury_code_key" ON "Treasury"("code");
CREATE INDEX IF NOT EXISTS "Treasury_isActive_idx" ON "Treasury"("isActive");

CREATE INDEX IF NOT EXISTS "TreasuryEntry_treasuryId_entryDate_idx"
ON "TreasuryEntry"("treasuryId", "entryDate");
CREATE INDEX IF NOT EXISTS "TreasuryEntry_entryType_idx"
ON "TreasuryEntry"("entryType");
CREATE INDEX IF NOT EXISTS "TreasuryEntry_direction_idx"
ON "TreasuryEntry"("direction");
CREATE INDEX IF NOT EXISTS "TreasuryEntry_referenceType_referenceId_idx"
ON "TreasuryEntry"("referenceType", "referenceId");
CREATE INDEX IF NOT EXISTS "TreasuryEntry_paymentMethodId_idx"
ON "TreasuryEntry"("paymentMethodId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryEntry_treasuryId_fkey'
  ) THEN
    ALTER TABLE "TreasuryEntry"
      ADD CONSTRAINT "TreasuryEntry_treasuryId_fkey"
      FOREIGN KEY ("treasuryId") REFERENCES "Treasury"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryEntry_paymentMethodId_fkey'
  ) THEN
    ALTER TABLE "TreasuryEntry"
      ADD CONSTRAINT "TreasuryEntry_paymentMethodId_fkey"
      FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryEntry_sourceTreasuryId_fkey'
  ) THEN
    ALTER TABLE "TreasuryEntry"
      ADD CONSTRAINT "TreasuryEntry_sourceTreasuryId_fkey"
      FOREIGN KEY ("sourceTreasuryId") REFERENCES "Treasury"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryEntry_targetTreasuryId_fkey'
  ) THEN
    ALTER TABLE "TreasuryEntry"
      ADD CONSTRAINT "TreasuryEntry_targetTreasuryId_fkey"
      FOREIGN KEY ("targetTreasuryId") REFERENCES "Treasury"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Treasury" ("name", "code", "description", "openingBalance", "currentBalance", "isActive")
VALUES ('Main Treasury', 'MAIN', 'Default treasury created by migration', 0, 0, true)
ON CONFLICT ("code") DO NOTHING;

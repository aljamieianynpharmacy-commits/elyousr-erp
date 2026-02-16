-- =========================
-- TREASURY ENUM EXTENSIONS
-- =========================
DO $$
BEGIN
  ALTER TYPE "TreasuryEntryType" ADD VALUE IF NOT EXISTS 'DEPOSIT_IN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "TreasuryEntryType" ADD VALUE IF NOT EXISTS 'DEPOSIT_REFUND';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TreasuryReconciliationStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'LOCKED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "PaymentAllocationSourceType" AS ENUM (
    'CUSTOMER_PAYMENT',
    'DEPOSIT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =========================
-- TREASURY ENTRY EXTENSIONS
-- =========================
ALTER TABLE "TreasuryEntry"
ADD COLUMN IF NOT EXISTS "note" TEXT;

ALTER TABLE "TreasuryEntry"
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

ALTER TABLE "TreasuryEntry"
ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER;

ALTER TABLE "TreasuryEntry"
ADD COLUMN IF NOT EXISTS "meta" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryEntry_idempotencyKey_key"
ON "TreasuryEntry"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "TreasuryEntry_treasuryId_createdAt_idx"
ON "TreasuryEntry"("treasuryId", "createdAt");

CREATE INDEX IF NOT EXISTS "TreasuryEntry_entryType_createdAt_idx"
ON "TreasuryEntry"("entryType", "createdAt");

CREATE INDEX IF NOT EXISTS "TreasuryEntry_paymentMethodId_createdAt_idx"
ON "TreasuryEntry"("paymentMethodId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryEntry_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "TreasuryEntry"
      ADD CONSTRAINT "TreasuryEntry_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================
-- DAY LOCK TABLE
-- =========================
CREATE TABLE IF NOT EXISTS "TreasuryDayLock" (
  "id" SERIAL NOT NULL,
  "treasuryId" INTEGER NOT NULL,
  "lockDate" TIMESTAMP(3) NOT NULL,
  "isLocked" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT,
  "lockedByUserId" INTEGER,
  "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unlockedByUserId" INTEGER,
  "unlockedAt" TIMESTAMP(3),
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryDayLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryDayLock_treasuryId_lockDate_key"
ON "TreasuryDayLock"("treasuryId", "lockDate");

CREATE INDEX IF NOT EXISTS "TreasuryDayLock_lockDate_isLocked_idx"
ON "TreasuryDayLock"("lockDate", "isLocked");

CREATE INDEX IF NOT EXISTS "TreasuryDayLock_lockedByUserId_lockedAt_idx"
ON "TreasuryDayLock"("lockedByUserId", "lockedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryDayLock_treasuryId_fkey'
  ) THEN
    ALTER TABLE "TreasuryDayLock"
      ADD CONSTRAINT "TreasuryDayLock_treasuryId_fkey"
      FOREIGN KEY ("treasuryId") REFERENCES "Treasury"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryDayLock_lockedByUserId_fkey'
  ) THEN
    ALTER TABLE "TreasuryDayLock"
      ADD CONSTRAINT "TreasuryDayLock_lockedByUserId_fkey"
      FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryDayLock_unlockedByUserId_fkey'
  ) THEN
    ALTER TABLE "TreasuryDayLock"
      ADD CONSTRAINT "TreasuryDayLock_unlockedByUserId_fkey"
      FOREIGN KEY ("unlockedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================
-- RECONCILIATION TABLE
-- =========================
CREATE TABLE IF NOT EXISTS "TreasuryReconciliation" (
  "id" SERIAL NOT NULL,
  "treasuryId" INTEGER NOT NULL,
  "reconciliationDate" TIMESTAMP(3) NOT NULL,
  "expectedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "countedCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "variance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason" TEXT,
  "status" "TreasuryReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedByUserId" INTEGER,
  "submittedAt" TIMESTAMP(3),
  "approvedByUserId" INTEGER,
  "approvedAt" TIMESTAMP(3),
  "approvalNotes" TEXT,
  "dayLockedAt" TIMESTAMP(3),
  "adjustmentEntryId" INTEGER,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreasuryReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TreasuryReconciliation_treasuryId_reconciliationDate_key"
ON "TreasuryReconciliation"("treasuryId", "reconciliationDate");

CREATE INDEX IF NOT EXISTS "TreasuryReconciliation_reconciliationDate_status_idx"
ON "TreasuryReconciliation"("reconciliationDate", "status");

CREATE INDEX IF NOT EXISTS "TreasuryReconciliation_submittedByUserId_createdAt_idx"
ON "TreasuryReconciliation"("submittedByUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "TreasuryReconciliation_approvedByUserId_createdAt_idx"
ON "TreasuryReconciliation"("approvedByUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryReconciliation_treasuryId_fkey'
  ) THEN
    ALTER TABLE "TreasuryReconciliation"
      ADD CONSTRAINT "TreasuryReconciliation_treasuryId_fkey"
      FOREIGN KEY ("treasuryId") REFERENCES "Treasury"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryReconciliation_submittedByUserId_fkey'
  ) THEN
    ALTER TABLE "TreasuryReconciliation"
      ADD CONSTRAINT "TreasuryReconciliation_submittedByUserId_fkey"
      FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryReconciliation_approvedByUserId_fkey'
  ) THEN
    ALTER TABLE "TreasuryReconciliation"
      ADD CONSTRAINT "TreasuryReconciliation_approvedByUserId_fkey"
      FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TreasuryReconciliation_adjustmentEntryId_fkey'
  ) THEN
    ALTER TABLE "TreasuryReconciliation"
      ADD CONSTRAINT "TreasuryReconciliation_adjustmentEntryId_fkey"
      FOREIGN KEY ("adjustmentEntryId") REFERENCES "TreasuryEntry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================
-- PAYMENT ALLOCATION TABLE
-- =========================
CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
  "id" SERIAL NOT NULL,
  "customerId" INTEGER,
  "saleId" INTEGER NOT NULL,
  "sourceType" "PaymentAllocationSourceType" NOT NULL,
  "customerPaymentId" INTEGER,
  "treasuryEntryId" INTEGER,
  "amount" DOUBLE PRECISION NOT NULL,
  "allocationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "meta" JSONB,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentAllocation_saleId_allocationDate_idx"
ON "PaymentAllocation"("saleId", "allocationDate");

CREATE INDEX IF NOT EXISTS "PaymentAllocation_customerPaymentId_idx"
ON "PaymentAllocation"("customerPaymentId");

CREATE INDEX IF NOT EXISTS "PaymentAllocation_treasuryEntryId_idx"
ON "PaymentAllocation"("treasuryEntryId");

CREATE INDEX IF NOT EXISTS "PaymentAllocation_sourceType_allocationDate_idx"
ON "PaymentAllocation"("sourceType", "allocationDate");

CREATE INDEX IF NOT EXISTS "PaymentAllocation_customerId_allocationDate_idx"
ON "PaymentAllocation"("customerId", "allocationDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_customerId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_saleId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_saleId_fkey"
      FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_customerPaymentId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_customerPaymentId_fkey"
      FOREIGN KEY ("customerPaymentId") REFERENCES "CustomerPayment"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_treasuryEntryId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_treasuryEntryId_fkey"
      FOREIGN KEY ("treasuryEntryId") REFERENCES "TreasuryEntry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaymentAllocation_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "PaymentAllocation"
      ADD CONSTRAINT "PaymentAllocation_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =========================
-- MINIMAL AUDIT LOG TABLE
-- =========================
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" SERIAL NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "treasuryId" INTEGER,
  "treasuryEntryId" INTEGER,
  "referenceType" TEXT,
  "referenceId" INTEGER,
  "performedByUserId" INTEGER,
  "note" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
ON "AuditLog"("action", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx"
ON "AuditLog"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AuditLog_treasuryId_createdAt_idx"
ON "AuditLog"("treasuryId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_treasuryEntryId_createdAt_idx"
ON "AuditLog"("treasuryEntryId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_referenceType_referenceId_idx"
ON "AuditLog"("referenceType", "referenceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_treasuryId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_treasuryId_fkey"
      FOREIGN KEY ("treasuryId") REFERENCES "Treasury"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_treasuryEntryId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_treasuryEntryId_fkey"
      FOREIGN KEY ("treasuryEntryId") REFERENCES "TreasuryEntry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_performedByUserId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_performedByUserId_fkey"
      FOREIGN KEY ("performedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Remove treasury day locking and reconciliation objects completely.

DROP TABLE IF EXISTS "TreasuryReconciliation" CASCADE;
DROP TABLE IF EXISTS "TreasuryDayLock" CASCADE;
DROP TYPE IF EXISTS "TreasuryReconciliationStatus";

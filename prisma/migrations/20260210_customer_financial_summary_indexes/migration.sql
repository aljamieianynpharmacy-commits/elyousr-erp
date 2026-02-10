-- Customer financial summary columns
ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "balance" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "firstActivityDate" TIMESTAMP(3);

ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "lastPaymentDate" TIMESTAMP(3);

ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "financialsUpdatedAt" TIMESTAMP(3);

-- Customer indexes (filters + sorting)
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer"("name");
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX IF NOT EXISTS "Customer_city_idx" ON "Customer"("city");
CREATE INDEX IF NOT EXISTS "Customer_customerType_idx" ON "Customer"("customerType");
CREATE INDEX IF NOT EXISTS "Customer_financialsUpdatedAt_idx" ON "Customer"("financialsUpdatedAt");
CREATE INDEX IF NOT EXISTS "Customer_balance_idx" ON "Customer"("balance");
CREATE INDEX IF NOT EXISTS "Customer_lastPaymentDate_idx" ON "Customer"("lastPaymentDate");
CREATE INDEX IF NOT EXISTS "Customer_createdAt_idx" ON "Customer"("createdAt");
CREATE INDEX IF NOT EXISTS "Customer_customerType_city_idx" ON "Customer"("customerType", "city");

-- Related table indexes used by customer financial operations
CREATE INDEX IF NOT EXISTS "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX IF NOT EXISTS "Sale_customerId_invoiceDate_idx" ON "Sale"("customerId", "invoiceDate");
CREATE INDEX IF NOT EXISTS "CustomerPayment_customerId_idx" ON "CustomerPayment"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerPayment_customerId_paymentDate_idx" ON "CustomerPayment"("customerId", "paymentDate");
CREATE INDEX IF NOT EXISTS "CustomerTransaction_customerId_date_idx" ON "CustomerTransaction"("customerId", "date");
CREATE INDEX IF NOT EXISTS "CustomerTransaction_referenceType_referenceId_idx" ON "CustomerTransaction"("referenceType", "referenceId");

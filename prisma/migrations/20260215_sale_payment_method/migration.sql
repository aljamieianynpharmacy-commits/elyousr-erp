-- Add payment method relation to sales
ALTER TABLE "Sale"
ADD COLUMN IF NOT EXISTS "paymentMethodId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Sale_paymentMethodId_fkey'
  ) THEN
    ALTER TABLE "Sale"
    ADD CONSTRAINT "Sale_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Sale_paymentMethodId_idx" ON "Sale"("paymentMethodId");

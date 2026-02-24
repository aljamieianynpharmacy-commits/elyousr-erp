-- Prevent deleting customers that have linked sales/financial records.

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"Sale"'::regclass
      AND confrelid = '"Customer"'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "Sale" DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  ALTER TABLE "Sale"
    ADD CONSTRAINT "Sale_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"Return"'::regclass
      AND confrelid = '"Customer"'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "Return" DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  ALTER TABLE "Return"
    ADD CONSTRAINT "Return_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"CustomerPayment"'::regclass
      AND confrelid = '"Customer"'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "CustomerPayment" DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  ALTER TABLE "CustomerPayment"
    ADD CONSTRAINT "CustomerPayment_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"CustomerTransaction"'::regclass
      AND confrelid = '"Customer"'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "CustomerTransaction" DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  ALTER TABLE "CustomerTransaction"
    ADD CONSTRAINT "CustomerTransaction_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = '"PaymentAllocation"'::regclass
      AND confrelid = '"Customer"'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE "PaymentAllocation" DROP CONSTRAINT %I', fk.conname);
  END LOOP;

  ALTER TABLE "PaymentAllocation"
    ADD CONSTRAINT "PaymentAllocation_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
END $$;

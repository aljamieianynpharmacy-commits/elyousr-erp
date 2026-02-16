-- =========================
-- TREASURY SOFT DELETE
-- =========================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Treasury'
  ) THEN
    ALTER TABLE "Treasury"
    ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;

    CREATE INDEX IF NOT EXISTS "Treasury_isDeleted_idx"
    ON "Treasury"("isDeleted");
  END IF;
END $$;

-- =========================
-- TREASURY DEFAULT FLAG
-- =========================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Treasury'
  ) THEN
    ALTER TABLE "Treasury"
    ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

    CREATE INDEX IF NOT EXISTS "Treasury_isDefault_idx"
    ON "Treasury"("isDefault");

    -- Keep exactly one default treasury when records exist.
    WITH preferred AS (
      SELECT "id"
      FROM "Treasury"
      WHERE "code" = 'MAIN'
      ORDER BY "id"
      LIMIT 1
    ),
    active_fallback AS (
      SELECT "id"
      FROM "Treasury"
      WHERE "isActive" = true
      ORDER BY "createdAt" ASC, "id" ASC
      LIMIT 1
    ),
    any_fallback AS (
      SELECT "id"
      FROM "Treasury"
      ORDER BY "createdAt" ASC, "id" ASC
      LIMIT 1
    ),
    chosen AS (
      SELECT "id" FROM preferred
      UNION ALL
      SELECT "id" FROM active_fallback
      UNION ALL
      SELECT "id" FROM any_fallback
      LIMIT 1
    )
    UPDATE "Treasury"
    SET "isDefault" = CASE
      WHEN "id" = (SELECT "id" FROM chosen) THEN true
      ELSE false
    END;

    CREATE UNIQUE INDEX IF NOT EXISTS "Treasury_one_default_true_idx"
    ON "Treasury"("isDefault")
    WHERE "isDefault" = true;
  END IF;
END $$;

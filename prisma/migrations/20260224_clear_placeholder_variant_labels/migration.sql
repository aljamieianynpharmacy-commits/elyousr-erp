-- Normalize legacy placeholder variant labels so products without real variants
-- do not carry "Standard/Default/موحد/افتراضي" values.

WITH target_variants AS (
    SELECT v."id", v."productId"
    FROM "Variant" v
    WHERE lower(btrim(COALESCE(v."productSize", ''))) IN ('standard', 'default', 'موحد', 'افتراضي', '-')
      AND lower(btrim(COALESCE(v."color", ''))) IN ('standard', 'default', 'موحد', 'افتراضي', '-')
)
UPDATE "Variant" v
SET
    "productSize" = '',
    "color" = ''
WHERE v."id" IN (
    SELECT tv."id"
    FROM target_variants tv
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Variant" conflict
        WHERE conflict."productId" = tv."productId"
          AND conflict."id" <> tv."id"
          AND COALESCE(conflict."productSize", '') = ''
          AND COALESCE(conflict."color", '') = ''
    )
);

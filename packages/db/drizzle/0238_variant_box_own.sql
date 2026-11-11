-- A variant can pick its own box instead of the product's Package (#1517). Null or false follows
-- the product: the product page writes its Package onto those variants only, so a variant with its
-- own box keeps it. Nullable, so an older build that never writes it keeps working during a
-- rolling deploy.
ALTER TABLE "variant" ADD COLUMN IF NOT EXISTS "box_own" boolean;
--> statement-breakpoint
-- Variants whose box already differs from the rest of their product (set from the bulk sheet or
-- the products list) keep that box: the most common box among a product's live variants is the
-- product's, every other box is the variant's own.
WITH boxes AS (
  SELECT id, product_id,
    concat_ws('|', coalesce(box_preset_id, ''), coalesce(package_length_cm, 0),
      coalesce(package_width_cm, 0), coalesce(package_height_cm, 0)) AS box,
    position
  FROM "variant"
  WHERE archived_at IS NULL
),
ranked AS (
  SELECT product_id, box,
    row_number() OVER (PARTITION BY product_id ORDER BY count(*) DESC, min(position)) AS rank
  FROM boxes
  GROUP BY product_id, box
)
UPDATE "variant" v SET box_own = true
FROM boxes b
JOIN ranked r ON r.product_id = b.product_id AND r.rank = 1
WHERE v.id = b.id AND b.box <> r.box AND v.box_own IS NULL;

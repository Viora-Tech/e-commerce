ALTER TABLE "customer" ADD COLUMN "default_address" jsonb;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "accepts_marketing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Until now every checkout inserted its own customer row. Fold them into one row
-- per (store, email): keep the earliest, repoint orders and carts, drop the rest.
UPDATE "customer" SET "email" = lower(trim("email")) WHERE "email" IS NOT NULL AND "email" <> lower(trim("email"));--> statement-breakpoint
WITH keep AS (
  SELECT DISTINCT ON ("store_id", "email") "id", "store_id", "email"
  FROM "customer" WHERE "email" IS NOT NULL
  ORDER BY "store_id", "email", "id"
), dupes AS (
  SELECT c."id" AS dupe_id, k."id" AS keep_id
  FROM "customer" c JOIN keep k ON k."store_id" = c."store_id" AND k."email" = c."email"
  WHERE c."id" <> k."id"
)
UPDATE "order" o SET "customer_id" = d.keep_id FROM dupes d WHERE o."customer_id" = d.dupe_id;--> statement-breakpoint
WITH keep AS (
  SELECT DISTINCT ON ("store_id", "email") "id", "store_id", "email"
  FROM "customer" WHERE "email" IS NOT NULL
  ORDER BY "store_id", "email", "id"
), dupes AS (
  SELECT c."id" AS dupe_id, k."id" AS keep_id
  FROM "customer" c JOIN keep k ON k."store_id" = c."store_id" AND k."email" = c."email"
  WHERE c."id" <> k."id"
)
UPDATE "cart" ca SET "customer_id" = d.keep_id FROM dupes d WHERE ca."customer_id" = d.dupe_id;--> statement-breakpoint
DELETE FROM "customer" c USING (
  SELECT DISTINCT ON ("store_id", "email") "id", "store_id", "email"
  FROM "customer" WHERE "email" IS NOT NULL
  ORDER BY "store_id", "email", "id"
) k WHERE c."store_id" = k."store_id" AND c."email" = k."email" AND c."id" <> k."id";--> statement-breakpoint
-- Orders placed before customer rows existed: create the customer from the order.
INSERT INTO "customer" ("id", "store_id", "email", "phone", "name")
SELECT DISTINCT ON (o."store_id", lower(trim(o."email")))
  gen_random_uuid(), o."store_id", lower(trim(o."email")), o."phone", a."name"
FROM "order" o LEFT JOIN "address" a ON a."id" = o."shipping_address_id"
WHERE o."customer_id" IS NULL AND o."email" IS NOT NULL
ORDER BY o."store_id", lower(trim(o."email")), o."placed_at";--> statement-breakpoint
UPDATE "order" o SET "customer_id" = c."id"
FROM "customer" c
WHERE o."customer_id" IS NULL AND o."email" IS NOT NULL
  AND c."store_id" = o."store_id" AND c."email" = lower(trim(o."email"));--> statement-breakpoint
-- Newest shipping address becomes the profile's default address; created_at = first order.
UPDATE "customer" c SET
  "default_address" = jsonb_build_object(
    'name', a."name", 'line1', a."line1", 'line2', a."line2", 'city', a."city",
    'stateCode', a."state_code", 'pincode', a."pincode", 'country', a."country", 'phone', a."phone"),
  "phone" = coalesce(c."phone", a."phone"),
  "name" = coalesce(c."name", a."name")
FROM (
  SELECT DISTINCT ON (o."customer_id") o."customer_id", o."shipping_address_id"
  FROM "order" o WHERE o."customer_id" IS NOT NULL AND o."shipping_address_id" IS NOT NULL
  ORDER BY o."customer_id", o."placed_at" DESC
) latest JOIN "address" a ON a."id" = latest."shipping_address_id"
WHERE c."id" = latest."customer_id";--> statement-breakpoint
UPDATE "customer" c SET "created_at" = f.first_order
FROM (SELECT "customer_id", min("placed_at") AS first_order FROM "order" WHERE "customer_id" IS NOT NULL GROUP BY "customer_id") f
WHERE c."id" = f."customer_id";--> statement-breakpoint
CREATE UNIQUE INDEX "customer_store_email" ON "customer" USING btree ("store_id","email");

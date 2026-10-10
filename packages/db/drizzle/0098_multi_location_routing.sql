DROP INDEX "inventory_level_one_sellable";--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "needs_transfer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "inventory_level_variant_sellable" ON "inventory_level" USING btree ("variant_id") WHERE "inventory_level"."fulfils_online";--> statement-breakpoint
-- A level row sells online exactly when its location ships online orders and is active.
CREATE OR REPLACE FUNCTION inventory_level_fill_location() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."location_id" IS NULL THEN
    NEW."location_id" := ensure_default_location(NEW."store_id");
  END IF;
  NEW."fulfils_online" := COALESCE(
    (SELECT "fulfils_online_orders" AND "active" FROM "location" WHERE "id" = NEW."location_id"),
    false
  );
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION location_sync_fulfils_online() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "inventory_level"
  SET "fulfils_online" = (NEW."fulfils_online_orders" AND NEW."active")
  WHERE "location_id" = NEW."id"
    AND "fulfils_online" IS DISTINCT FROM (NEW."fulfils_online_orders" AND NEW."active");
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS location_sync_fulfils_online ON "location";--> statement-breakpoint
CREATE TRIGGER location_sync_fulfils_online AFTER UPDATE OF "fulfils_online_orders", "active" ON "location"
FOR EACH ROW EXECUTE FUNCTION location_sync_fulfils_online();--> statement-breakpoint
-- BACKFILL: priorities follow today's order (default first, then oldest), and every level row
-- agrees with its location.
UPDATE "location" l SET "priority" = r."rn" - 1
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "store_id" ORDER BY "is_default" DESC, "created_at", "id") AS "rn"
  FROM "location"
) r
WHERE r."id" = l."id" AND l."priority" <> r."rn" - 1;--> statement-breakpoint
UPDATE "inventory_level" il SET "fulfils_online" = (l."fulfils_online_orders" AND l."active")
FROM "location" l
WHERE l."id" = il."location_id" AND il."fulfils_online" IS DISTINCT FROM (l."fulfils_online_orders" AND l."active");

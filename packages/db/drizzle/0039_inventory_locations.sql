CREATE TABLE "location" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"line1" text,
	"line2" text,
	"city" text,
	"state_code" text,
	"pincode" text,
	"country" text DEFAULT 'IN' NOT NULL,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"fulfils_online_orders" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"supplier_name" text NOT NULL,
	"supplier_email" text,
	"supplier_phone" text,
	"location_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"expected_at" timestamp with time zone,
	"currency" text DEFAULT 'INR' NOT NULL,
	"shipping_paise" integer DEFAULT 0 NOT NULL,
	"tax_paise" integer DEFAULT 0 NOT NULL,
	"note" text,
	"ordered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"received" integer DEFAULT 0 NOT NULL,
	"unit_cost_paise" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"note" text,
	"shipped_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_level" DROP CONSTRAINT "inventory_level_variant_id_unique";--> statement-breakpoint
ALTER TABLE "inventory_adjustment" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_level" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_level" ADD COLUMN "incoming" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_level" ADD COLUMN "fulfils_online" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "low_stock_threshold" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_purchase_order_id_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_line" ADD CONSTRAINT "purchase_order_line_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_from_location_id_location_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_to_location_id_location_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_transfer_id_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_line" ADD CONSTRAINT "transfer_line_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "location_one_default" ON "location" USING btree ("store_id") WHERE "location"."is_default";--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_store_number" ON "purchase_order" USING btree ("store_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_store_number" ON "transfer" USING btree ("store_id","number");--> statement-breakpoint
ALTER TABLE "inventory_adjustment" ADD CONSTRAINT "inventory_adjustment_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_level_variant_location" ON "inventory_level" USING btree ("variant_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_level_one_sellable" ON "inventory_level" USING btree ("variant_id") WHERE "inventory_level"."fulfils_online";--> statement-breakpoint
-- Every store gets a default location that fulfils online orders.
INSERT INTO "location" ("id", "store_id", "name", "is_default", "fulfils_online_orders")
SELECT gen_random_uuid(), s."id", 'Default location', true, true
FROM "store" s
WHERE NOT EXISTS (SELECT 1 FROM "location" l WHERE l."store_id" = s."id" AND l."is_default");--> statement-breakpoint
UPDATE "inventory_level" il SET "location_id" = l."id"
FROM "location" l
WHERE l."store_id" = il."store_id" AND l."is_default" AND il."location_id" IS NULL;--> statement-breakpoint
UPDATE "inventory_adjustment" ia SET "location_id" = l."id"
FROM "location" l
WHERE l."store_id" = ia."store_id" AND l."is_default" AND ia."location_id" IS NULL;--> statement-breakpoint
ALTER TABLE "inventory_level" ALTER COLUMN "location_id" SET NOT NULL;--> statement-breakpoint
-- The store's default location, created on first use. Safe under concurrency:
-- the partial unique index decides the winner and the loser re-reads it.
CREATE OR REPLACE FUNCTION ensure_default_location(p_store uuid) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE loc uuid;
BEGIN
  SELECT "id" INTO loc FROM "location" WHERE "store_id" = p_store AND "is_default";
  IF loc IS NULL THEN
    INSERT INTO "location" ("id", "store_id", "name", "is_default", "fulfils_online_orders")
    VALUES (gen_random_uuid(), p_store, 'Default location', true, true)
    ON CONFLICT ("store_id") WHERE "is_default" DO NOTHING;
    SELECT "id" INTO loc FROM "location" WHERE "store_id" = p_store AND "is_default";
  END IF;
  RETURN loc;
END $$;--> statement-breakpoint
-- Inserts that do not name a location (every write path that predates
-- locations) land on the default one, and inherit whether it sells online.
CREATE OR REPLACE FUNCTION inventory_level_fill_location() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."location_id" IS NULL THEN
    NEW."location_id" := ensure_default_location(NEW."store_id");
  END IF;
  NEW."fulfils_online" := COALESCE(
    (SELECT "fulfils_online_orders" FROM "location" WHERE "id" = NEW."location_id"),
    false
  );
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS inventory_level_fill_location ON "inventory_level";--> statement-breakpoint
CREATE TRIGGER inventory_level_fill_location BEFORE INSERT ON "inventory_level"
FOR EACH ROW EXECUTE FUNCTION inventory_level_fill_location();--> statement-breakpoint
SELECT apply_store_rls();

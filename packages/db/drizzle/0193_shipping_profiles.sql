CREATE TABLE "shipping_profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_profile_product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"product_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipping_zone" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "shipping_profile" ADD CONSTRAINT "shipping_profile_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_profile_product" ADD CONSTRAINT "shipping_profile_product_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_profile_product" ADD CONSTRAINT "shipping_profile_product_profile_id_shipping_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."shipping_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_profile_product" ADD CONSTRAINT "shipping_profile_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_profile_one_default" ON "shipping_profile" USING btree ("store_id") WHERE "shipping_profile"."is_default";--> statement-breakpoint
CREATE INDEX "shipping_profile_store" ON "shipping_profile" USING btree ("store_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_profile_product_unique" ON "shipping_profile_product" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "shipping_profile_product_profile" ON "shipping_profile_product" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "shipping_zone" ADD CONSTRAINT "shipping_zone_profile_id_shipping_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."shipping_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_zone_profile" ON "shipping_zone" USING btree ("profile_id");--> statement-breakpoint
-- Every store gets its General profile, and the zones it has today become General's rates,
-- so checkout prices exactly as before until the merchant adds a custom profile.
INSERT INTO "shipping_profile" ("id", "store_id", "name", "is_default", "position")
SELECT gen_random_uuid(), s."id", 'General', true, 0 FROM "store" s
WHERE NOT EXISTS (
	SELECT 1 FROM "shipping_profile" p WHERE p."store_id" = s."id" AND p."is_default"
);--> statement-breakpoint
UPDATE "shipping_zone" z SET "profile_id" = p."id"
FROM "shipping_profile" p
WHERE p."store_id" = z."store_id" AND p."is_default" AND z."profile_id" IS NULL;--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "shipping_profile";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "shipping_profile" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "shipping_profile";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "shipping_profile"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "shipping_profile_product";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "shipping_profile_product"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();

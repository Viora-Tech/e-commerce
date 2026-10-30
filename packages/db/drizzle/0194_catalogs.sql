CREATE TABLE "catalog" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	"price_adjustment_bp" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_status" CHECK ("catalog"."status" in ('active', 'draft')),
	CONSTRAINT "catalog_scope" CHECK ("catalog"."scope" in ('all', 'chosen')),
	CONSTRAINT "catalog_adjustment" CHECK ("catalog"."price_adjustment_bp" between -9000 and 20000)
);
--> statement-breakpoint
CREATE TABLE "catalog_collection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"catalog_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_price" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"catalog_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_price_currency" CHECK ("catalog_price"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "catalog_price_positive" CHECK ("catalog_price"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog_product" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"catalog_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market" ADD COLUMN "catalog_id" uuid;--> statement-breakpoint
ALTER TABLE "catalog" ADD CONSTRAINT "catalog_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_collection" ADD CONSTRAINT "catalog_collection_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_collection" ADD CONSTRAINT "catalog_collection_catalog_id_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_collection" ADD CONSTRAINT "catalog_collection_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price" ADD CONSTRAINT "catalog_price_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price" ADD CONSTRAINT "catalog_price_catalog_id_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_price" ADD CONSTRAINT "catalog_price_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_catalog_id_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_store" ON "catalog" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_collection_unique" ON "catalog_collection" USING btree ("catalog_id","collection_id");--> statement-breakpoint
CREATE INDEX "catalog_collection_collection" ON "catalog_collection" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_price_unique" ON "catalog_price" USING btree ("catalog_id","variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_product_unique" ON "catalog_product" USING btree ("catalog_id","product_id");--> statement-breakpoint
CREATE INDEX "catalog_product_product" ON "catalog_product" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "market" ADD CONSTRAINT "market_catalog_id_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalog"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "catalog";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "catalog" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
-- A catalog decides what a market's pages list and at what prices: a change drops the cache.
DROP TRIGGER IF EXISTS storefront_cache_notify ON "catalog";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "catalog"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "catalog_collection";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "catalog_collection"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "catalog_price";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "catalog_price"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "catalog_product";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "catalog_product"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();

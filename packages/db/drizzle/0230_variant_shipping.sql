-- Per-variant shipping (Shopify's profiles hold variants, and each variant says whether it is a
-- physical product). A variant placed in a profile on its own wins over its product's profile;
-- `requires_shipping` false keeps a variant out of the shipping charge and out of shipments.
CREATE TABLE "shipping_profile_variant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipping_profile_variant" ADD CONSTRAINT "shipping_profile_variant_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_profile_variant" ADD CONSTRAINT "shipping_profile_variant_profile_id_shipping_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."shipping_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_profile_variant" ADD CONSTRAINT "shipping_profile_variant_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_profile_variant_unique" ON "shipping_profile_variant" USING btree ("store_id","variant_id");--> statement-breakpoint
CREATE INDEX "shipping_profile_variant_profile" ON "shipping_profile_variant" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "requires_shipping" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "requires_shipping" boolean DEFAULT true NOT NULL;--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "shipping_profile_variant";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "shipping_profile_variant"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();

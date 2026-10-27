-- Several images per variant, in order. `variant.media_id` stays as the variant's main image
-- (position 0 here) so cart and order lines, feeds, catalogue sync and Liquid `variant.image`
-- read it unchanged. Backfills one row per variant that already has an image.
CREATE TABLE IF NOT EXISTS "variant_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variant_media" ADD CONSTRAINT "variant_media_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variant_media" ADD CONSTRAINT "variant_media_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "variant_media" ADD CONSTRAINT "variant_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variant_media_unique" ON "variant_media" USING btree ("variant_id","media_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variant_media_media" ON "variant_media" USING btree ("media_id");--> statement-breakpoint
INSERT INTO "variant_media" ("id", "store_id", "variant_id", "media_id", "position")
SELECT gen_random_uuid(), v."store_id", v."id", v."media_id", 0 FROM "variant" v
WHERE v."media_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
SELECT apply_store_rls();--> statement-breakpoint
-- The product page shows a variant's images, so a write drops the store's cached pages (0115).
DROP TRIGGER IF EXISTS storefront_cache_notify ON "variant_media";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "variant_media"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();

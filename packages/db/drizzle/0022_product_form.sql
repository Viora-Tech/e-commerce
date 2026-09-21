CREATE TABLE "inventory_adjustment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Existing descriptions are plain strings from the Shopify import; keep them as
-- JSON strings so parseRichText can still read them as legacy text.
ALTER TABLE "product" ALTER COLUMN "description" SET DATA TYPE jsonb USING CASE WHEN "description" IS NULL OR "description" = '' THEN NULL ELSE to_jsonb("description") END;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "seo_title" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "seo_description" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "cost_paise" integer;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "taxable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "track_inventory" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_adjustment" ADD CONSTRAINT "inventory_adjustment_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment" ADD CONSTRAINT "inventory_adjustment_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_adjustment_variant_idx" ON "inventory_adjustment" USING btree ("variant_id","created_at");--> statement-breakpoint
SELECT apply_store_rls();

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "tax_included" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "sale_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "sale_ends_at" timestamp with time zone;

ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'order' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "min_quantity" integer;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "bxgy" jsonb;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "shipping_states" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "max_shipping_paise" integer;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "customer_eligibility" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "eligible_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN IF NOT EXISTS "combines_with" jsonb DEFAULT '{"products":false,"order":false,"shipping":false}'::jsonb NOT NULL;--> statement-breakpoint
-- Idempotent: only rows still on the column default are touched, so a rerun never undoes a type set since.
UPDATE "discount" SET "type" = CASE WHEN "method" = 'free_shipping' THEN 'shipping' ELSE 'products' END
WHERE "type" = 'order' AND ("method" = 'free_shipping' OR "applies_to" <> 'all');

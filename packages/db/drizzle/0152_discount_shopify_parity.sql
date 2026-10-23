ALTER TABLE "discount" ADD COLUMN "type" text DEFAULT 'order' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "min_quantity" integer;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "bxgy" jsonb;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "shipping_states" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "max_shipping_paise" integer;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "customer_eligibility" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "eligible_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "combines_with" jsonb DEFAULT '{"products":false,"order":false,"shipping":false}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "discount" SET "type" = CASE
  WHEN "method" = 'free_shipping' THEN 'shipping'
  WHEN "applies_to" <> 'all' THEN 'products'
  ELSE 'order'
END;

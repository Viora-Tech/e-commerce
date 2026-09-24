ALTER TABLE "cart_line" ADD COLUMN IF NOT EXISTS "preorder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deposit_paise" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "balance_due_paise" integer;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "balance_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "preorder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "preorder_ship_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_ship_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_ships_in_days" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_limit" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_button_label" text DEFAULT 'Pre-order' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_payment_mode" text DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_deposit_paise" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_deposit_percent" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "preorder_hide_until_launch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "launch_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN IF NOT EXISTS "preorder_override" jsonb;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "product" ADD CONSTRAINT "product_preorder_deposit_percent" CHECK ("preorder_deposit_percent" is null or ("preorder_deposit_percent" between 1 and 99));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
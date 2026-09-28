ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_gstin" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "buyer_business_name" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "customer_note" text;

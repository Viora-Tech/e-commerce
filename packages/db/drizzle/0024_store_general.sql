ALTER TABLE "store" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "address" jsonb;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "timezone" text DEFAULT 'Asia/Kolkata' NOT NULL;
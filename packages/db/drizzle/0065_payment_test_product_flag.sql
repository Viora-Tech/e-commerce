ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "is_system_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint

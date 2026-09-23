-- Admin accent colour: the owner's store default and each member's own choice.
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "admin_accent" text;--> statement-breakpoint
ALTER TABLE "store_member" ADD COLUMN IF NOT EXISTS "admin_accent" text;

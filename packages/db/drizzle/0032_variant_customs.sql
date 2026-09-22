ALTER TABLE "variant" ADD COLUMN IF NOT EXISTS "hs_code" text;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN IF NOT EXISTS "country_of_origin" text;

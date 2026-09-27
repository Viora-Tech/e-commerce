ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "variants" jsonb;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "thumbhash" text;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "processed_at" timestamp with time zone;
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "process_error" text;

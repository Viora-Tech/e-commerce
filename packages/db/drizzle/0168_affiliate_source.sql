ALTER TABLE "affiliate" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'applied' NOT NULL;

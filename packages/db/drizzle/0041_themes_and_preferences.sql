CREATE TABLE IF NOT EXISTS "theme" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'unpublished' NOT NULL,
	"preset" text,
	"settings" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "theme_role" CHECK ("theme"."role" in ('main','unpublished'))
);
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "preferences" jsonb;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theme" ADD CONSTRAINT "theme_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "theme_one_main_per_store" ON "theme" USING btree ("store_id") WHERE role = 'main';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_store" ON "theme" USING btree ("store_id");--> statement-breakpoint
-- Every store's existing theme tokens become its live (main) theme, named after
-- the preset it came from. Stores that already have a main theme are skipped.
INSERT INTO "theme" ("id", "store_id", "name", "role", "preset", "settings", "published_at")
SELECT gen_random_uuid(), s."id",
	initcap(coalesce(s."theme"->>'preset', 'waimers')), 'main',
	coalesce(s."theme"->>'preset', 'waimers'), coalesce(s."theme", '{}'::jsonb), now()
FROM "store" s
WHERE NOT EXISTS (SELECT 1 FROM "theme" t WHERE t."store_id" = s."id" AND t."role" = 'main');--> statement-breakpoint
SELECT apply_store_rls();

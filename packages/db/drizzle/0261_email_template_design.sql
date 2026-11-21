-- Settings → Notifications → Edit design: a store's own block layout for one transactional
-- email. One row per store and template; no row sends the built-in email. New table only, so an
-- older build that never reads it keeps working during a rolling deploy.
CREATE TABLE IF NOT EXISTS "email_template_design" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"template" text NOT NULL,
	"design" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "email_template_design" ADD CONSTRAINT "email_template_design_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_template_design_store_template" ON "email_template_design" USING btree ("store_id","template");--> statement-breakpoint
SELECT apply_store_rls();

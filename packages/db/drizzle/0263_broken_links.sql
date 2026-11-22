-- Content › Menus › URL redirects › Broken links: storefront paths that answered 404, counted
-- per store so the merchant can redirect the ones that get traffic. New table only, so an older
-- build that never writes it keeps working during a rolling deploy.
CREATE TABLE IF NOT EXISTS "broken_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"path" text NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"referrer" text,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "broken_link" ADD CONSTRAINT "broken_link_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broken_link_store_path" ON "broken_link" USING btree ("store_id","path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broken_link_store_hits" ON "broken_link" USING btree ("store_id","hits");--> statement-breakpoint
SELECT apply_store_rls();

-- Online store › SEO › Search opportunities: the weekly SEO email to the store owner. One row per
-- store and week, made when that week's email is claimed (the unique key makes overlapping worker
-- ticks send once); `pages` keeps each page's Google position so next week can say what moved.
-- New table and function only, so an older build keeps working during a rolling deploy.
CREATE TABLE IF NOT EXISTS "seo_weekly_snapshot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"week_key" text NOT NULL,
	"pages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "seo_weekly_snapshot" ADD CONSTRAINT "seo_weekly_snapshot_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_weekly_snapshot_store_week" ON "seo_weekly_snapshot" USING btree ("store_id","week_key");--> statement-breakpoint
-- Stores with the Google Search Console app installed, connected and on a property, for the
-- weekly SEO email sweep; the sweep then works per store under RLS. Ids only, same pattern as
-- stores_with_search_console_due (0119).
CREATE OR REPLACE FUNCTION stores_with_search_console_connected() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM store
  WHERE apps -> 'installed' ? 'google-search-console'
    AND coalesce(apps -> 'settings' -> 'google-search-console' ->> 'refreshToken', '') <> ''
    AND coalesce(apps -> 'settings' -> 'google-search-console' ->> 'property', '') <> '';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_search_console_connected() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_search_console_connected() TO app;
--> statement-breakpoint
SELECT apply_store_rls();

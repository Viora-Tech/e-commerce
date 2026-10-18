CREATE TABLE "search_console_row" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"period" text NOT NULL,
	"dimension" text NOT NULL,
	"page" text,
	"path" text,
	"query" text,
	"segment" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_console_row_period_check" CHECK ("search_console_row"."period" in ('current', 'previous')),
	CONSTRAINT "search_console_row_dimension_check" CHECK ("search_console_row"."dimension" in ('total', 'page', 'query', 'page_query', 'device', 'country'))
);
--> statement-breakpoint
ALTER TABLE "search_console_row" ADD CONSTRAINT "search_console_row_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_console_row_store_dimension" ON "search_console_row" USING btree ("store_id","dimension","period");--> statement-breakpoint
CREATE INDEX "search_console_row_store_path" ON "search_console_row" USING btree ("store_id","path");--> statement-breakpoint
-- Stores with the Google Search Console app installed and connected to a property whose last
-- sync attempt is over 20 hours old, for the worker's daily sync; the sync then works per store
-- under RLS. Ids only, same pattern as stores_with_member_daily_summaries (0111).
CREATE OR REPLACE FUNCTION stores_with_search_console_due() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM store
  WHERE apps -> 'installed' ? 'google-search-console'
    AND coalesce(apps -> 'settings' -> 'google-search-console' ->> 'refreshToken', '') <> ''
    AND coalesce(apps -> 'settings' -> 'google-search-console' ->> 'property', '') <> ''
    AND coalesce(
      nullif(apps -> 'settings' -> 'google-search-console' ->> 'attemptedAt', '')::timestamptz,
      'epoch'::timestamptz
    ) < now() - interval '20 hours';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_search_console_due() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_search_console_due() TO app;
--> statement-breakpoint
SELECT apply_store_rls();

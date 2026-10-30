CREATE TABLE "home_card" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"dismissed_at" timestamp with time zone,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_card_run" (
	"store_id" uuid PRIMARY KEY NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "home_card" ADD CONSTRAINT "home_card_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_card_run" ADD CONSTRAINT "home_card_run_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "home_card_store_key" ON "home_card" USING btree ("store_id","key");--> statement-breakpoint
CREATE INDEX "home_card_run_refreshed" ON "home_card_run" USING btree ("refreshed_at");
--> statement-breakpoint
-- Stores whose Home cards were not rebuilt in the last 20 hours (or never), for the worker's
-- daily refresh. Only stores with at least one product: an empty store has nothing to suggest.
CREATE OR REPLACE FUNCTION stores_with_home_cards_due(at timestamptz DEFAULT now()) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM store s
  WHERE EXISTS (SELECT 1 FROM product p WHERE p.store_id = s.id)
    AND NOT EXISTS (
      SELECT 1 FROM home_card_run r
      WHERE r.store_id = s.id AND r.refreshed_at > at - interval '20 hours'
    );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_home_cards_due(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_home_cards_due(timestamptz) TO app;--> statement-breakpoint
SELECT apply_store_rls();

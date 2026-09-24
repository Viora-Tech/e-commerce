-- Transactional outbox: every place that enqueued a notification, an app hook or a
-- marketing trigger directly instead writes one row here, in the same transaction as
-- the state change. A worker relay reads undispatched rows and fans them out.
-- Pattern from Trigger.dev's task-run event log (Apache-2.0) and Temporal's
-- event-sourced workflow history (MIT): durable append log first, delivery as a
-- separate, retryable concern.
CREATE TABLE IF NOT EXISTS "outbox_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_event_undispatched" ON "outbox_event" USING btree ("store_id","created_at") WHERE "outbox_event"."dispatched_at" is null;--> statement-breakpoint
-- The relay runs on the app role and needs to know WHICH stores have undispatched
-- rows before it can scope a transaction to each. SECURITY DEFINER exposes only the
-- store ids, same pattern as stores_with_unpaid_online_orders (0056).
CREATE OR REPLACE FUNCTION stores_with_undispatched_outbox_events() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "outbox_event" WHERE dispatched_at IS NULL;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_undispatched_outbox_events() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_undispatched_outbox_events() TO app;
--> statement-breakpoint
SELECT apply_store_rls();

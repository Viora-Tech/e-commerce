ALTER TABLE "shopify_import_issue" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "shopify_import_issue" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD COLUMN "snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD COLUMN "snapshot_taken_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD COLUMN "snapshot_use" jsonb;--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD COLUMN "retry_of" uuid;--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD CONSTRAINT "shopify_import_run_retry_of_shopify_import_run_id_fk" FOREIGN KEY ("retry_of") REFERENCES "public"."shopify_import_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopify_import_run_snapshot_taken" ON "shopify_import_run" USING btree ("snapshot_taken_at") WHERE "shopify_import_run"."snapshot_taken_at" is not null;--> statement-breakpoint
ALTER TABLE "shopify_import_issue" ADD CONSTRAINT "shopify_import_issue_kind" CHECK ("shopify_import_issue"."kind" in ('record', 'media', 'file'));
--> statement-breakpoint
-- Store ids with a Shopify import preview snapshot taken before the cutoff, for
-- the worker's cleanup job (the snapshot files live in each store's storage, so
-- the job then works per store under RLS). Ids only, same pattern as
-- stores_with_balance_due (0059).
CREATE OR REPLACE FUNCTION stores_with_stale_import_snapshots(cutoff timestamptz) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM shopify_import_run
  WHERE snapshot_taken_at IS NOT NULL AND snapshot_taken_at < cutoff;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_stale_import_snapshots(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_stale_import_snapshots(timestamptz) TO app;

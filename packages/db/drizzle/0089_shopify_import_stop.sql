ALTER TABLE "shopify_import_run" DROP CONSTRAINT "shopify_import_run_status";--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD COLUMN "stop_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD COLUMN "stopped_by" text;--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD CONSTRAINT "shopify_import_run_status" CHECK ("shopify_import_run"."status" in ('queued', 'running', 'completed', 'failed', 'cancelled'));
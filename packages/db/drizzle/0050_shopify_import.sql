/* Shopify migration: URL redirects served by the storefront, imported historical
   orders (read-only, flagged by imported_from), and the Shopify importer app's
   connection, runs, per-row issues and id mapping. Idempotent. */
CREATE TABLE IF NOT EXISTS "url_redirect" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"path" text NOT NULL,
	"target" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopify_import_issue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"resource" text NOT NULL,
	"row" integer,
	"ref" text,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopify_import_mapping" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"resource" text NOT NULL,
	"source_id" text NOT NULL,
	"local_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopify_import_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"resources" text[] NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"file_key" text,
	"file_name" text,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preview" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_by" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_import_run_mode" CHECK ("shopify_import_run"."mode" in ('csv', 'api')),
	CONSTRAINT "shopify_import_run_status" CHECK ("shopify_import_run"."status" in ('queued', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shopify_import_connection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"shop_domain" text NOT NULL,
	"access_token" text NOT NULL,
	"shop_name" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "imported_from" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "import_meta" jsonb;--> statement-breakpoint
ALTER TABLE "url_redirect" DROP CONSTRAINT IF EXISTS "url_redirect_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "url_redirect" ADD CONSTRAINT "url_redirect_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_import_issue" DROP CONSTRAINT IF EXISTS "shopify_import_issue_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "shopify_import_issue" ADD CONSTRAINT "shopify_import_issue_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_import_issue" DROP CONSTRAINT IF EXISTS "shopify_import_issue_run_id_shopify_import_run_id_fk";--> statement-breakpoint
ALTER TABLE "shopify_import_issue" ADD CONSTRAINT "shopify_import_issue_run_id_shopify_import_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."shopify_import_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_import_mapping" DROP CONSTRAINT IF EXISTS "shopify_import_mapping_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "shopify_import_mapping" ADD CONSTRAINT "shopify_import_mapping_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_import_run" DROP CONSTRAINT IF EXISTS "shopify_import_run_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "shopify_import_run" ADD CONSTRAINT "shopify_import_run_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopify_import_connection" DROP CONSTRAINT IF EXISTS "shopify_import_connection_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "shopify_import_connection" ADD CONSTRAINT "shopify_import_connection_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "url_redirect_store_path" ON "url_redirect" USING btree ("store_id","path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopify_import_issue_run" ON "shopify_import_issue" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shopify_import_mapping_source" ON "shopify_import_mapping" USING btree ("store_id","resource","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopify_import_mapping_local" ON "shopify_import_mapping" USING btree ("store_id","resource","local_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopify_import_run_store_created" ON "shopify_import_run" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shopify_import_connection_store" ON "shopify_import_connection" USING btree ("store_id");--> statement-breakpoint
SELECT apply_store_rls();

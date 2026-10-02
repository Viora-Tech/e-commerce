-- Shopify theme import: an imported theme's files and its import record. Safe to run on a
-- database that already ran this branch's earlier 0081 (same tables): every statement is guarded.
CREATE TABLE IF NOT EXISTS "theme_file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"path" text NOT NULL,
	"body" text NOT NULL,
	"encoding" text DEFAULT 'utf8' NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_file_encoding" CHECK ("theme_file"."encoding" in ('utf8','base64'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "theme_import" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"theme_id" uuid NOT NULL,
	"source" text DEFAULT 'shopify' NOT NULL,
	"file_name" text NOT NULL,
	"theme_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"report" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_import_source" CHECK ("theme_import"."source" in ('shopify'))
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theme_file" ADD CONSTRAINT "theme_file_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theme_file" ADD CONSTRAINT "theme_file_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theme_import" ADD CONSTRAINT "theme_import_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "theme_import" ADD CONSTRAINT "theme_import_theme_id_theme_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "theme_file_path" ON "theme_file" USING btree ("theme_id","path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_file_store" ON "theme_file" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "theme_import_theme" ON "theme_import" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_import_store" ON "theme_import" USING btree ("store_id");--> statement-breakpoint
SELECT apply_store_rls();

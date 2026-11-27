-- GST invoices: edit an issued tax invoice in place until its month's GSTR-1 is filed (owner,
-- 28 Nov 2026). Each edit keeps the snapshot it replaced here, with who, when, why and what
-- changed; the invoice row keeps the latest. New table only, so an older build keeps working
-- during a rolling deploy and a same-day rollback is safe.
CREATE TABLE IF NOT EXISTS "invoice_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_version" ADD CONSTRAINT "invoice_version_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "invoice_version" ADD CONSTRAINT "invoice_version_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_version_invoice_version" ON "invoice_version" USING btree ("invoice_id","version");--> statement-breakpoint
SELECT apply_store_rls();

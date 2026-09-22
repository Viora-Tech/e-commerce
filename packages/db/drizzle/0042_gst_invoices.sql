/* GST invoices app: per-variant GST rate (null = store default), the rate and
   HSN each order line was charged at, and the app's own tables. Additive and
   re-runnable. */
CREATE TABLE IF NOT EXISTS "invoice" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"refund_id" uuid,
	"kind" text NOT NULL,
	"number" text,
	"fy_start_year" integer,
	"seq" integer,
	"snapshot" jsonb NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_gstin" text,
	"place_of_supply" text,
	"taxable_paise" integer NOT NULL,
	"cgst_paise" integer NOT NULL,
	"sgst_paise" integer NOT NULL,
	"igst_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"pdf_key" text,
	"pdf_status" text DEFAULT 'pending' NOT NULL,
	"pdf_error" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_kind_check" CHECK ("invoice"."kind" in ('tax_invoice', 'credit_note', 'packing_slip', 'order_confirmation')),
	CONSTRAINT "invoice_pdf_status_check" CHECK ("invoice"."pdf_status" in ('pending', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_batch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"sku" text,
	"hsn" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit" text NOT NULL,
	"unit_price_paise" integer NOT NULL,
	"discount_paise" integer NOT NULL,
	"taxable_paise" integer NOT NULL,
	"rate_percent" integer NOT NULL,
	"cgst_paise" integer NOT NULL,
	"sgst_paise" integer NOT NULL,
	"igst_paise" integer NOT NULL,
	"total_paise" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_sequence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"fy_start_year" integer NOT NULL,
	"next" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "gst_rate_percent" integer;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "hs_code" text;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN IF NOT EXISTS "gst_rate_percent" integer;--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_order_id_order_id_fk";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_refund_id_refund_id_fk";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_refund_id_refund_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refund"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_batch" DROP CONSTRAINT IF EXISTS "invoice_batch_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "invoice_batch" ADD CONSTRAINT "invoice_batch_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" DROP CONSTRAINT IF EXISTS "invoice_line_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" DROP CONSTRAINT IF EXISTS "invoice_line_invoice_id_invoice_id_fk";--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequence" DROP CONSTRAINT IF EXISTS "invoice_sequence_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "invoice_sequence" ADD CONSTRAINT "invoice_sequence_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_settings" DROP CONSTRAINT IF EXISTS "invoice_settings_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_number_unique" ON "invoice" USING btree ("store_id","kind","fy_start_year","number") WHERE "invoice"."number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_order_kind_unique" ON "invoice" USING btree ("store_id","order_id","kind") WHERE "invoice"."kind" <> 'credit_note';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_refund_unique" ON "invoice" USING btree ("store_id","refund_id") WHERE "invoice"."refund_id" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_store_issued" ON "invoice" USING btree ("store_id","issued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_invoice" ON "invoice_line" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_sequence_series" ON "invoice_sequence" USING btree ("store_id","kind","fy_start_year");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_settings_store" ON "invoice_settings" USING btree ("store_id");
--> statement-breakpoint
SELECT apply_store_rls();

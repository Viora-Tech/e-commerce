/* GST invoices: numbering series (one counter per store, series and FY), an
   invoice queue (unnumbered drafts, numbered only at issue), cancellation until
   reported, receipt and refund vouchers, and per-month filed/closed periods. */
CREATE TABLE IF NOT EXISTS "invoice_period" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"period" text NOT NULL,
	"gstr1_filed_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_kind_check";--> statement-breakpoint
DROP INDEX IF EXISTS "invoice_order_kind_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "invoice_sequence_series";--> statement-breakpoint
DROP INDEX IF EXISTS "invoice_number_unique";--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'issued' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "series_id" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "invoice_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "eligible_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "reported_period" text;--> statement-breakpoint
ALTER TABLE "invoice_sequence" ADD COLUMN IF NOT EXISTS "series_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Counters and documents from before series map onto the default domestic series.
UPDATE "invoice_sequence" SET "series_id" = CASE "kind" WHEN 'tax_invoice' THEN 'inv' WHEN 'credit_note' THEN 'cn' WHEN 'receipt_voucher' THEN 'rv' ELSE 'rfv' END WHERE "series_id" = '';--> statement-breakpoint
UPDATE "invoice" SET "series_id" = CASE "kind" WHEN 'tax_invoice' THEN 'inv' WHEN 'credit_note' THEN 'cn' END WHERE "series_id" IS NULL AND "number" IS NOT NULL;--> statement-breakpoint
UPDATE "invoice" SET "invoice_date" = "issued_at" WHERE "invoice_date" IS NULL AND "status" <> 'draft';--> statement-breakpoint
ALTER TABLE "invoice_period" DROP CONSTRAINT IF EXISTS "invoice_period_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "invoice_period" ADD CONSTRAINT "invoice_period_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_period_store" ON "invoice_period" USING btree ("store_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_order_kind_live" ON "invoice" USING btree ("store_id","order_id","kind") WHERE "invoice"."kind" <> 'credit_note' and "invoice"."status" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_sequence_series_fy" ON "invoice_sequence" USING btree ("store_id","series_id","fy_start_year");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_number_unique" ON "invoice" USING btree ("store_id","fy_start_year","number") WHERE "invoice"."number" is not null;--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_status_check";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_status_check" CHECK ("invoice"."status" in ('draft', 'issued', 'cancelled'));--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_kind_check";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_kind_check" CHECK ("invoice"."kind" in ('tax_invoice', 'credit_note', 'packing_slip', 'order_confirmation', 'receipt_voucher', 'refund_voucher'));
--> statement-breakpoint
SELECT apply_store_rls();

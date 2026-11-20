-- "Already invoiced" in the GST invoices queue (owner 18 Nov 2026): some orders were invoiced
-- earlier outside Koomerce, by hand or in a previous billing system. Staff record that invoice's
-- number and date; the row counts in GSTR-1 like any invoice and its number stays used, but it
-- has no PDF here. `source` says who issued the invoice; `pdf_status` gains `none` for "no PDF
-- to draw". Additive (the column defaults to koomerce), so an older build keeps working during a
-- rolling deploy.
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'koomerce' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_source_check";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_source_check" CHECK ("invoice"."source" in ('koomerce', 'external'));--> statement-breakpoint
ALTER TABLE "invoice" DROP CONSTRAINT IF EXISTS "invoice_pdf_status_check";--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_pdf_status_check" CHECK ("invoice"."pdf_status" in ('pending', 'ready', 'failed', 'none'));

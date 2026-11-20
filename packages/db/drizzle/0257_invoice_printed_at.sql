-- When staff first printed or downloaded an invoice's PDF (owner, 18 Nov 2026): the GST Invoices
-- list shows "Not printed" until then. Nullable and additive. Invoices issued before this keep
-- null, so they show "Not printed" once; printing them clears it.
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "printed_at" timestamp with time zone;

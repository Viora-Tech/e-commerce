-- A parcel the courier lost (owner, 18 Nov 2026): its own status `lost` (status is a plain text
-- column, no check constraint), when it was lost, when it was sent again, and the courier claim.
-- Nullable and additive, so an older build that never reads them keeps working during a deploy.
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "lost_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "reshipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "claim_status" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "claim_amount_paise" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "claim_note" text;

-- A parcel the courier lost (owner, 18 Nov 2026): its own status `lost` (status is a plain text
-- column, no check constraint), when it was lost, when it was sent again, and the courier claim.
-- Nullable and additive, so an older build that never reads them keeps working during a deploy.
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "lost_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "reshipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "claim_status" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "claim_amount_paise" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "claim_note" text;--> statement-breakpoint
-- The tracking job also asks about a lost parcel for 30 days (LOST_TRACK_DAYS in
-- @commerce/core shipping/shipments.ts), so one the courier finds moves on by itself.
CREATE OR REPLACE FUNCTION stores_with_open_shipments() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM shipment
  WHERE status IN ('created', 'picked_up', 'in_transit', 'out_for_delivery')
     OR (status = 'lost' AND lost_at >= now() - interval '30 days');
$$;

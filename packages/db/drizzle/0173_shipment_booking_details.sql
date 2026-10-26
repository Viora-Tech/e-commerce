-- Booking facts kept on the shipment for its details view: COD or prepaid and the amount as
-- booked (the merchant can switch them from the order's own), the pickup location name sent and
-- the courier service picked. A pickup request remembers the courier pickup location it was
-- raised for, so a second booking that day joins it instead of raising a duplicate.
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "payment_mode" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "cod_amount_paise" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "pickup_location_name" text;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "service_label" text;--> statement-breakpoint
ALTER TABLE "shipment_pickup" ADD COLUMN IF NOT EXISTS "pickup_location_name" text;

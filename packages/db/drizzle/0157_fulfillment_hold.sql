-- A fulfilment can be held (Automations' "Hold fulfilment"): no shipment is booked until it is released.
ALTER TABLE "fulfillment_order" ADD COLUMN "held_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "hold_reason" text;
-- Staff can hold an order's fulfilment from the order page (#1011): why (a fixed reason) and who.
ALTER TABLE "fulfillment_order" ADD COLUMN "hold_code" text;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "held_by" text;

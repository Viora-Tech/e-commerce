-- Partial shipments (Figma 916:10179): when staff ship some items now and the rest become a new
-- parcel ("Part 2"), the new parcel keeps why it was split and when the customer was told that
-- the order ships in parts. Both nullable: parcels made any other way have neither. The table's
-- RLS (store_id) already covers the new columns.
ALTER TABLE "fulfillment_order" ADD COLUMN IF NOT EXISTS "split_reason" text;
ALTER TABLE "fulfillment_order" ADD COLUMN IF NOT EXISTS "customer_told_at" timestamp with time zone;

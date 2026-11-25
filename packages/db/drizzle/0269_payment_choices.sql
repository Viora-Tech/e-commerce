-- Owner decisions 24 Nov 2026. Additive only.
-- A cart line added at a sale price is re-priced at the live price once the sale ends; this
-- keeps the old price so the cart and checkout can say the sale ended for that item.
ALTER TABLE "cart_line" ADD COLUMN IF NOT EXISTS "sale_ended_from_paise" integer;
--> statement-breakpoint
-- The checkout device (a first-party cookie) the order was placed from: the hourly cap of
-- unpaid checkouts counts by it as well as by email and phone.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "checkout_device_id" text;

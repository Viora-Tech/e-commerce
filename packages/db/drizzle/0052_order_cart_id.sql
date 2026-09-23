-- One order per cart: a second submit of the same cart finds the first order.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "cart_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_store_cart_unique" ON "order" USING btree ("store_id","cart_id") WHERE "order"."cart_id" is not null;

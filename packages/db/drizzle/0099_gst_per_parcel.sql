ALTER TABLE "fulfillment_order" ADD COLUMN "subtotal_paise" integer;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "discount_paise" integer;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "adjustment_paise" integer;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "shipping_paise" integer;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "total_paise" integer;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "tax_paise" integer;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "tax_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD COLUMN "tax_origin" jsonb;--> statement-breakpoint
-- BACKFILL: an order with one parcel is that parcel: it takes the order's money and GST as
-- charged. Orders with more parcels keep nulls (none exist before 0098 shipped).
UPDATE "fulfillment_order" f SET
  "subtotal_paise" = o."subtotal_paise",
  "discount_paise" = o."discount_paise",
  "adjustment_paise" = o."payment_adjustment_paise",
  "shipping_paise" = o."shipping_paise",
  "total_paise" = o."total_paise",
  "tax_paise" = o."tax_paise",
  "tax_breakdown" = o."tax_breakdown",
  "tax_origin" = o."tax_origin"
FROM "order" o
WHERE o."id" = f."order_id"
  AND f."subtotal_paise" IS NULL
  AND o."status" <> 'draft'
  AND (SELECT count(*) FROM "fulfillment_order" x WHERE x."order_id" = f."order_id") = 1;

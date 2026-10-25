DROP INDEX "invoice_order_kind_live";--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "fulfillment_order_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_fulfillment_order_id_fulfillment_order_id_fk" FOREIGN KEY ("fulfillment_order_id") REFERENCES "public"."fulfillment_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_order_kind_live" ON "invoice" USING btree ("store_id","order_id",coalesce("fulfillment_order_id", '00000000-0000-0000-0000-000000000000'::uuid),"kind") WHERE "invoice"."kind" <> 'credit_note' and "invoice"."status" <> 'cancelled';--> statement-breakpoint
-- BACKFILL: an order with one parcel billed that parcel with its tax invoice.
UPDATE "invoice" i SET "fulfillment_order_id" = f."id"
FROM "fulfillment_order" f
WHERE f."order_id" = i."order_id"
  AND i."kind" = 'tax_invoice'
  AND i."fulfillment_order_id" IS NULL
  AND (SELECT count(*) FROM "fulfillment_order" x WHERE x."order_id" = i."order_id") = 1;

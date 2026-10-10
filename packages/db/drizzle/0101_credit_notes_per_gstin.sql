DROP INDEX "invoice_refund_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_refund_unique" ON "invoice" USING btree ("store_id","refund_id",coalesce("fulfillment_order_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "invoice"."refund_id" is not null;--> statement-breakpoint
-- BACKFILL: a credit note corrects its order's only parcel.
UPDATE "invoice" i SET "fulfillment_order_id" = f."id"
FROM "fulfillment_order" f
WHERE f."order_id" = i."order_id"
  AND i."kind" = 'credit_note'
  AND i."fulfillment_order_id" IS NULL
  AND (SELECT count(*) FROM "fulfillment_order" x WHERE x."order_id" = i."order_id") = 1;

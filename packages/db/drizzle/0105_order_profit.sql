ALTER TABLE "order_line" ADD COLUMN "cost_at_sale_paise" integer;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "cost_estimated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "fee_paise" integer;--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "courier_charge_paise" integer;--> statement-breakpoint
-- BACKFILL: orders placed before cost snapshots take their variant's cost as it is now, marked
-- estimated so profit says so. Gift cards and drafts keep null.
UPDATE "order_line" ol SET "cost_at_sale_paise" = v."cost_paise", "cost_estimated" = true
FROM "variant" v, "order" o
WHERE v."id" = ol."variant_id" AND o."id" = ol."order_id"
  AND ol."cost_at_sale_paise" IS NULL AND v."cost_paise" IS NOT NULL
  AND NOT ol."gift_card" AND o."status" <> 'draft';

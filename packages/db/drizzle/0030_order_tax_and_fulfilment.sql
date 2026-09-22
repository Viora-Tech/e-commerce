ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "tax_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "tax_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "fulfilled_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "gst_rate_percent" integer DEFAULT 18 NOT NULL;--> statement-breakpoint
/* Orders already packed or delivered are fully fulfilled; anything else starts at zero.
   Columns only, so the table-level grants from apply_store_rls() already cover them. */
UPDATE "order_line" ol SET "fulfilled_quantity" = ol."quantity"
FROM "order" o WHERE o."id" = ol."order_id" AND o."status" IN ('fulfilled', 'delivered')
  AND ol."fulfilled_quantity" <> ol."quantity";

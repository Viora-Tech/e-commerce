ALTER TABLE "order" ADD COLUMN "tax_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tax_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "fulfilled_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
/* Orders already packed or delivered are fully fulfilled; anything else starts at zero. */
UPDATE "order_line" ol SET "fulfilled_quantity" = ol."quantity"
FROM "order" o WHERE o."id" = ol."order_id" AND o."status" IN ('fulfilled', 'delivered');

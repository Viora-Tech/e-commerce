ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "balance_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "balance_reminders_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "purpose" text DEFAULT 'order' NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "preorder" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_balance_due" ON "order" USING btree ("store_id","placed_at") WHERE "order"."balance_due_paise" > 0 and "order"."balance_paid_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_one_open_balance_attempt" ON "payment" USING btree ("store_id","order_id") WHERE "payment"."purpose" = 'balance' and "payment"."status" in ('created', 'pending', 'authorized');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_one_balance_capture" ON "payment" USING btree ("store_id","order_id") WHERE "payment"."purpose" = 'balance' and "payment"."status" = 'captured' and not "payment"."refund_needed";--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "payment" ADD CONSTRAINT "payment_purpose_check" CHECK ("payment"."purpose" in ('order', 'balance'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
-- Store ids with a pre-order balance still owed on a live order, for the
-- balance job (auto-request, reminders, unpaid-balance cancel). Ids only,
-- same pattern as stores_with_unpaid_online_orders (0056).
CREATE OR REPLACE FUNCTION stores_with_balance_due() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE balance_due_paise > 0
    AND balance_paid_at IS NULL
    AND status NOT IN ('cancelled', 'draft')
    AND imported_from IS NULL;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_balance_due() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_balance_due() TO app;

-- Manual UPI / bank transfer follow-up: when the merchant last sent a payment
-- reminder (6-hour resend limit), and when they were told of the auto-cancel.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "payment_reminder_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "unpaid_cancel_notice_at" timestamp with time zone;
--> statement-breakpoint
-- Store ids with placed manual-transfer orders, for the opt-in auto-cancel job
-- (merchant notice, then cancel). Ids only, same pattern as stores_with_unpaid_online_orders (0056).
CREATE OR REPLACE FUNCTION stores_with_pending_manual_orders() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE status = 'placed'
    AND imported_from IS NULL
    AND payment_method = 'manual';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_pending_manual_orders() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_pending_manual_orders() TO app;

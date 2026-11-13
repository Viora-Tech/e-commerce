-- "Ask to pay online" (owner, 13 Nov 2026): staff ask a cash on delivery shopper to pay through
-- the store's gateway instead (no courier takes COD to their PIN). When the link went out, and
-- the one reminder two days later. Both nullable; the order table's RLS (store_id) covers them.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "pay_online_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "pay_online_reminded_at" timestamp with time zone;--> statement-breakpoint
-- Store ids with a pay-online request still waiting for its reminder, for the worker's sweep.
-- Ids only, same pattern as stores_with_pending_cod_checks (0172).
CREATE OR REPLACE FUNCTION stores_with_pay_online_requests() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE pay_online_requested_at IS NOT NULL
    AND pay_online_reminded_at IS NULL
    AND checkout_paid_at IS NULL
    AND payment_method = 'cod'
    AND status = 'open';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_pay_online_requests() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_pay_online_requests() TO app;

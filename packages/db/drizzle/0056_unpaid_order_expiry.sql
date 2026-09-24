-- Unpaid order expiry: the worker job reads the oldest placed orders per store.
CREATE INDEX IF NOT EXISTS "order_placed_at_unpaid" ON "order" USING btree ("store_id","placed_at") WHERE "order"."status" = 'placed';
--> statement-breakpoint
-- The expiry job runs on the app role and needs to know WHICH stores have
-- placed online orders before it can scope a transaction to each. SECURITY
-- DEFINER exposes only the store ids. Per-store windows are applied inside.
CREATE OR REPLACE FUNCTION stores_with_unpaid_online_orders() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE status = 'placed'
    AND imported_from IS NULL
    AND payment_method NOT IN ('cod', 'manual', 'gift_card');
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_unpaid_online_orders() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_unpaid_online_orders() TO app;

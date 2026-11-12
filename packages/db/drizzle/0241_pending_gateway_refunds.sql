-- Store ids with a gateway refund still pending, made 1 hour to 60 days ago, on a gateway whose
-- refund updates do not come by webhook (Decentro). For the worker's daily refund sync. Ids
-- only, same pattern as stores_with_unknown_payment_fees (0116).
CREATE OR REPLACE FUNCTION stores_with_pending_gateway_refunds() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT r.store_id FROM refund r
  JOIN payment p ON p.id = r.payment_id
  WHERE r.status = 'pending'
    AND r.provider_refund_id IS NOT NULL
    AND p.provider IN ('decentro')
    AND r.created_at > now() - interval '60 days'
    AND r.created_at < now() - interval '1 hour';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_pending_gateway_refunds() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_pending_gateway_refunds() TO app;

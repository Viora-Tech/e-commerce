-- Snapmint (direct cardless EMI) has no refund webhook either: its pending refunds join the
-- worker's daily refund sync beside Decentro's. Same function as 0241, one more provider.
CREATE OR REPLACE FUNCTION stores_with_pending_gateway_refunds() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT r.store_id FROM refund r
  JOIN payment p ON p.id = r.payment_id
  WHERE r.status = 'pending'
    AND r.provider_refund_id IS NOT NULL
    AND p.provider IN ('decentro', 'snapmint')
    AND r.created_at > now() - interval '60 days'
    AND r.created_at < now() - interval '1 hour';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_pending_gateway_refunds() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_pending_gateway_refunds() TO app;

-- stores_with_certificate_checks takes the clock it compares against, defaulting to now().
-- The sweep passes its own `now`, so the 3-day give-up and the daily re-check use the same
-- time in SQL and in code (and tests with a fixed clock stop depending on the real date).
DROP FUNCTION IF EXISTS stores_with_certificate_checks();--> statement-breakpoint
CREATE OR REPLACE FUNCTION stores_with_certificate_checks(at timestamptz DEFAULT now()) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM store_domain
  WHERE status = 'active' AND route_status = 'ready' AND (
    (ssl_status <> 'active' AND coalesce(ssl_started_at, created_at) > at - interval '3 days')
    OR (ssl_status = 'active' AND (ssl_checked_at IS NULL OR ssl_checked_at < at - interval '1 day'))
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_certificate_checks(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_certificate_checks(timestamptz) TO app;

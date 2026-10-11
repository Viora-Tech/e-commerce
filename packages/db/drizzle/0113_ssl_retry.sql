ALTER TABLE "store_domain" ADD COLUMN "ssl_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN "ssl_checked_at" timestamp with time zone;--> statement-breakpoint
-- Store ids with a domain whose certificate needs a look: not active yet (and inside the 3-day retry window),
-- or active but not checked in a day. For the worker's certificate sweep.
CREATE OR REPLACE FUNCTION stores_with_certificate_checks() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM store_domain
  WHERE status = 'active' AND route_status = 'ready' AND (
    (ssl_status <> 'active' AND coalesce(ssl_started_at, created_at) > now() - interval '3 days')
    OR (ssl_status = 'active' AND (ssl_checked_at IS NULL OR ssl_checked_at < now() - interval '1 day'))
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_certificate_checks() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_certificate_checks() TO app;

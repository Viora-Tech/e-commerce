-- Store addresses (<slug>.<PLATFORM_STORE_DOMAIN>) whose HTTPS route was never asked for. Until
-- 2026-10-24 the route was only requested when the admin process had the DOKPLOY_* keys, which
-- live on the worker, so most stores' addresses answered 404. The worker's domain poll uses this
-- to ask for the missing routes.
CREATE OR REPLACE FUNCTION stores_with_unrouted_platform_domains() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM store_domain
  WHERE kind = 'platform' AND route_status = 'none';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_unrouted_platform_domains() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_unrouted_platform_domains() TO app;

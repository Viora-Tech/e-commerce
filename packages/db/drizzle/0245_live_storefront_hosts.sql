-- Storefront warm-up after a deploy: the worker loads each store's front page on the new process
-- before shoppers do. It needs every live store's primary hostname, across stores, so this is a
-- SECURITY DEFINER function the app role may call (like the stores_with_* sweeps). Hostnames
-- only: nothing else about a store leaves its RLS.
CREATE OR REPLACE FUNCTION live_storefront_hosts() RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hostname FROM store_domain
  WHERE is_primary AND status = 'active'
  ORDER BY hostname
  LIMIT 50;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION live_storefront_hosts() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION live_storefront_hosts() TO app;

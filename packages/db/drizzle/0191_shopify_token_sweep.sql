-- Stores with a Shopify connection, for the worker's daily sweep that swaps a non-expiring
-- offline token from the Koomerce app for an expiring one (Shopify requires it by 1 Jan 2027).
CREATE OR REPLACE FUNCTION stores_with_shopify_connections() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM shopify_import_connection;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_shopify_connections() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_shopify_connections() TO app;

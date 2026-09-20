-- store_domain was added in 0002; apply RLS + grants to it.
SELECT apply_store_rls();

-- Hostname lookup that must work before a store context exists.
-- SECURITY DEFINER runs as the owner (bypasses RLS) but exposes only the id.
CREATE OR REPLACE FUNCTION resolve_store(p_hostname text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM store_domain WHERE hostname = lower(p_hostname) LIMIT 1;
$$;

REVOKE ALL ON FUNCTION resolve_store(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_store(text) TO app;

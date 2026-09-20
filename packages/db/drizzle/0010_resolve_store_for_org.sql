-- Organization -> store lookup before a store context exists (see resolve_store).
CREATE OR REPLACE FUNCTION resolve_store_for_organization(p_org text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM store WHERE organization_id = p_org LIMIT 1;
$$;
REVOKE ALL ON FUNCTION resolve_store_for_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_store_for_organization(text) TO app;

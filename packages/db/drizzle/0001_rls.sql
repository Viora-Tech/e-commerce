-- Grants and row-level security for the runtime role `app`.
-- Re-run `select apply_store_rls();` in every later migration that adds tables.

CREATE OR REPLACE FUNCTION apply_store_rls() RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  t record;
BEGIN
  GRANT USAGE ON SCHEMA public TO app;

  -- store: the tenant row itself, isolated by id.
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE store TO app;
  ALTER TABLE store ENABLE ROW LEVEL SECURITY;
  ALTER TABLE store FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS store_isolation ON store;
  CREATE POLICY store_isolation ON store
    USING (id = nullif(current_setting('app.store_id', true), '')::uuid)
    WITH CHECK (id = nullif(current_setting('app.store_id', true), '')::uuid);

  -- every table with a store_id column.
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'store_id'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO app', t.table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS store_isolation ON %I', t.table_name);
    EXECUTE format(
      'CREATE POLICY store_isolation ON %I USING (store_id = nullif(current_setting(''app.store_id'', true), '''')::uuid) WITH CHECK (store_id = nullif(current_setting(''app.store_id'', true), '''')::uuid)',
      t.table_name
    );
  END LOOP;

  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
END;
$$;

SELECT apply_store_rls();

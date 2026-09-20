-- Runtime role: cannot bypass RLS, does not own tables.
CREATE ROLE app LOGIN PASSWORD 'app' NOBYPASSRLS;
GRANT CONNECT ON DATABASE commerce TO app;
CREATE DATABASE commerce_test;
GRANT CONNECT ON DATABASE commerce_test TO app;
\connect commerce
GRANT USAGE ON SCHEMA public TO app;
\connect commerce_test
GRANT USAGE ON SCHEMA public TO app;

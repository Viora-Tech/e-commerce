-- Runtime role: cannot bypass RLS, does not own tables.
CREATE ROLE app LOGIN PASSWORD 'app' NOBYPASSRLS;
GRANT CONNECT ON DATABASE commerce TO app;
-- One test database per package so test suites can run in parallel.
CREATE DATABASE commerce_test_db;
CREATE DATABASE commerce_test_core;
CREATE DATABASE commerce_test_auth;
CREATE DATABASE commerce_test_api;
GRANT CONNECT ON DATABASE commerce_test_db TO app;
GRANT CONNECT ON DATABASE commerce_test_core TO app;
GRANT CONNECT ON DATABASE commerce_test_auth TO app;
GRANT CONNECT ON DATABASE commerce_test_api TO app;
\connect commerce
GRANT USAGE ON SCHEMA public TO app;
\connect commerce_test_db
GRANT USAGE ON SCHEMA public TO app;
\connect commerce_test_core
GRANT USAGE ON SCHEMA public TO app;
\connect commerce_test_auth
GRANT USAGE ON SCHEMA public TO app;
\connect commerce_test_api
GRANT USAGE ON SCHEMA public TO app;

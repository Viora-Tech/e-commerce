#!/bin/sh
# Runs once, only on a brand-new pgdata volume (the official postgres image's
# docker-entrypoint-initdb.d convention). Creates the RLS-restricted `app` role that the
# running apps connect as (DATABASE_URL) — the container's own POSTGRES_USER
# (docker-compose.prod.yml's ${POSTGRES_USER:-postgres}) is the owner role, used only by
# DATABASE_URL_OWNER (migrations, backup/restore). See docker/postgres/init.sql (the dev
# equivalent, which also creates per-package test databases this prod init doesn't need) and
# docs/security/data-protection.md, "Two DB roles".
#
# APP_DB_PASSWORD is required — set it in the server's .env alongside DATABASE_URL, which must
# use the same password (postgres://app:<APP_DB_PASSWORD>@postgres:5432/<POSTGRES_DB>).
set -eu

if [ -z "${APP_DB_PASSWORD:-}" ]; then
  echo "deploy/postgres/init.sh: APP_DB_PASSWORD is not set, refusing to create the app role" >&2
  exit 1
fi

# The password and database name go in as psql variables (:'pw' quotes a literal, :"db" an
# identifier), so a quote in either can never end the statement early. The heredoc is quoted
# ('EOSQL') so the shell does not expand anything inside it.
psql -v ON_ERROR_STOP=1 -v pw="$APP_DB_PASSWORD" -v db="$POSTGRES_DB" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
  -- Table/sequence/function grants are not here: migration 0001_rls.sql grants them per
  -- object as it creates the RLS policies, the same as dev (docker/postgres/init.sql).
  CREATE ROLE app LOGIN PASSWORD :'pw' NOBYPASSRLS;
  GRANT CONNECT ON DATABASE :"db" TO app;
  GRANT USAGE ON SCHEMA public TO app;
EOSQL

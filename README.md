# Commerce platform

Multi-tenant commerce core for Indian D2C stores. Session one: schema with
row-level security, place-order workflow, worker process. Design in
`docs/superpowers/specs/`, wider plan in `E:\Dev\Shopify\docs\`.

## Run

    bun install
    bun run infra:up          # postgres 17 + dragonfly
    cp .env.example .env
    bun run db:migrate        # applies to DATABASE_URL_OWNER in .env
    bun run test
    bun run --cwd apps/worker dev
    curl localhost:4100/health

Tests use `commerce_test`, created by `docker/postgres/init.sql` on first boot.
If the volume predates that file: `docker compose down -v && bun run infra:up`.
Test packages share that database, so `bun run test` runs them one at a time.

## Rules

- Every tenant table has `store_id`, RLS enabled and forced, policy `store_isolation`.
  Any migration that adds a table ends with `select apply_store_rls();`.
  `packages/db/test/rls-coverage.test.ts` fails otherwise.
- The app connects as role `app`. Never as `postgres` outside migrations and tests.
- Query tenant data only inside `withStore`. `withoutStore` is for migrations and
  cross-store jobs on the owner connection, and is named so it stands out.
- `core` and `db` never import from `features` or `apps`.
- Money is integer paise. Ids are UUID v7 from `newId()`.
- Queues talk to Dragonfly over the Redis protocol via ioredis. BullMQ queue
  names use a `{hashtag}` prefix and no colons.

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

Each test package has its own database (`commerce_test_db`, `commerce_test_core`),
created by `docker/postgres/init.sql` on first boot. Add one per new package there
and in its `vitest.config.ts` via `loadTestEnv`.
If the volume predates that file: `docker compose down -v && bun run infra:up`.

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

## Testing

- Vitest per package; `bun run test` runs them in parallel, `bun run test:coverage`
  enforces thresholds on `core` and `db`. Thresholds only go up.
- `fast-check` for properties: anything that computes money, allocates numbers,
  or orders steps gets a property test next to its example tests.
- Provider conformance: every `PaymentProvider` implementation runs
  `describePaymentProvider(...)` from `@commerce/core/testing` in its own test
  file. Fulfilment and notification suites follow the same pattern when those
  adapters arrive.
- Playwright, Vitest browser mode and MSW come in with the storefront and the
  first HTTP adapters, not before.

## Git workflow

- Branch names describe the work: `feat/storefront-product-page`,
  `feat/razorpay-adapter`, `fix/rls-order-number`, `chore/ci-dragonfly`.
- Every branch goes through a pull request, kept small enough to review in one
  sitting. CI must be green before merge.
- Merge with squash or fast-forward; no merge commits on `main`.

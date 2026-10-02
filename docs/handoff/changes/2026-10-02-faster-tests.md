# Faster tests: parallel files on per-worker databases, cheap reset, cached and shared turbo

**Branch** `chore/faster-tests` (from `main` at 3e5278c7), **no migration**. Owner's ask
(2026-10-02): "coding is fast, testing is the bottleneck". Full write-up for agents:
`docs/guardrails.md`, "Testing fast"; developer docs: Operations → Testing.

## What changed

- **Parallel test files, one database per worker.** The seven database-backed packages (`api`,
  `auth`, `core`, `db`, `plugin-back-in-stock`, `plugin-gst-invoices`, `plugin-shopify-import`)
  dropped `fileParallelism: false` for `...parallelDbTests()` (`@commerce/config/test-env`):
  `TEST_WORKERS` files at once, default 3, `TEST_WORKERS=1` = serial. Global setup
  (`prepareTestDatabases`, `packages/db/test/databases.ts`) migrates the package's test
  database, clones it per worker with `CREATE DATABASE … TEMPLATE` (`…_w1`, `_w2`, `_w3`), and on
  later runs keeps the copies and migrates them like the template. A setup file
  (`packages/config/src/test-worker.ts`) points each worker at its copy and its own
  `LOCAL_STORAGE_DIR`. Copies are never dropped: `DROP DATABASE` forces a checkpoint that took
  10+ minutes on the shared Docker volume during the first try.
- **`resetDb` deletes instead of truncating.** `TRUNCATE` of all ~110 tables took ~2 s on this
  machine and runs before almost every test; `DELETE` with FK triggers off for the transaction
  takes ~50 ms, sequences reset as `restart identity` did (falls back to `TRUNCATE` if the owner
  role isn't superuser).
- **Queue tests** run in parallel too; their Redis keys carry the worker id.
- **Turbo caches `test`** (and `typecheck`, which was already cached): inputs are the package,
  its workspace dependencies (migrations included), root `.env.test`; `api` also hashes
  `apps/storefront/src` (the leak test walks it). New root task `//#plugin-graph` covers
  `commerce.config.ts` / `commerce.blocks.config.ts` and every plugin they import, which core
  reaches without a package.json dependency; the 11 packages built on core depend on it via their
  own `turbo.json`. Sweep `u. turbo-cache-graph` keeps that list honest.
- **Shared cache across worktrees:** `bun run test` / `typecheck` / `test:coverage` and the new
  `bun run affected` / `bun run turbo:shared …` go through `scripts/turbo.ts`, which sets
  `TURBO_CACHE_DIR` to the main checkout's `.turbo/cache` (override with your own
  `TURBO_CACHE_DIR`). `build` stays plain turbo (the Docker builds have no `scripts/`).
- **Incremental typecheck:** `incremental: true` in `packages/config/tsconfig.base.json`;
  `*.tsbuildinfo` is a cached turbo output.
- The three migration-backfill tests in `packages/db` retry their DDL on a deadlock with
  autovacuum's ANALYZE (`test/retry-deadlock.ts`); seen once with the new delete-based reset.

## Numbers (TEST_DB_NAMESPACE=fasttests, 3 workers)

Measured while other agents were running suites and builds: 0.5–0.8 GB RAM free, the Postgres
container at 200%+ CPU. Absolute times are noisy; the ratios are the point.

| | Before | After |
| --- | --- | --- |
| `packages/api` suite (wall) | 949 s | 227 s |
| `packages/core` suite (wall) | 1312 s | 143 s (399 s with `TEST_WORKERS=1`) |
| `turbo run typecheck test --filter=@commerce/core`, 2nd run, no change | test not cached, full suite again | 0.5 s turbo, 1.4 s wall (FULL TURBO) |
| core `tsc --noEmit` | 135 s cold | 15 s warm no change, 10 s after a leaf edit |

## How agents should test

```sh
TEST_DB_NAMESPACE=<yours> bun run affected     # typecheck + test, changed packages + dependents
bun run turbo:shared run typecheck test --filter=@commerce/core
TEST_DB_NAMESPACE=<yours> bun run test         # everything; unchanged packages are cache hits
```

Keep `TEST_WORKERS` ≤ 3 while other agents build. Skip `next build` unless build config changed.

## Left undone / notes

- Plain `bunx turbo …` still uses the worktree's own `.turbo/cache`; to share it there too, set
  `TURBO_CACHE_DIR` machine-wide (e.g. `setx TURBO_CACHE_DIR "E:\Dev\my e-commerce\.turbo\cache"`).
- Each test file still imports the whole router (~10 s of module loading per api file). Two
  untried levers: vitest `isolate: false` (one module graph per worker, but module state then
  leaks between files) and `experimental.fsModuleCache` (transform cache on disk, experimental
  in vitest 4.1). Measure before turning either on.
- Old worker copies (`commerce_test_<ns>_*_w*`) stay in Postgres; drop them by hand to tidy up.

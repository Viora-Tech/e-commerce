# Shopify app: old non-expiring tokens swapped for expiring ones

Shopify emailed on 29 Oct 2026: the Koomerce Migration app had 1 token to migrate. Public apps
that still use non-expiring offline access tokens are de-listed and blocked from new installs on
1 Jan 2027, and those tokens get HTTP 403 from 1 Apr 2027. New installs already asked for
expiring tokens (`expiring=1`); older connections did not.

- `migrateAppToken` (`plugin-shopify-import/src/app-install.ts`) makes Shopify's token-exchange
  request, which needs no merchant session.
- `migrateSavedAppToken` (`connection.ts`) swaps a store's saved non-expiring `app` token and
  saves the new access and refresh tokens. It returns `migrated`, `not_needed` or `failed`. On
  failure the old token is kept, since Shopify accepts it until April, and the next try repeats
  the swap. A repeat within seven days returns the same pair.
- `clientFor` runs it before an import or sync uses the connection.
- The worker's daily `shopify-token-sweep` (`apps/worker/src/shopify-token-sweep.ts`) runs it
  for every store with a Shopify connection, so a store that never imports again is migrated
  too.
- Migration 0191 adds `stores_with_shopify_connections()`, a SECURITY DEFINER function, with
  `storesWithShopifyConnections` in `@commerce/db`.
- Sweeps: the worker entry is listed at 512 lines and the new worker file is in the
  service-layer list, as the other worker jobs are.

Tests: `plugin-shopify-import/test/app-install.test.ts` covers three cases: the swap on first
use with the exact request body, a refused swap keeping the old token, and expiring tokens or a
missing app left alone. That is 12 of 12 tests. The db package passes 57 tests, the sweeps pass
57 of 57, and tsc is clean for db, queue, plugin-shopify-import and worker.

After the deploy: Waimers' connection swaps on the next sweep (within a day of the worker
starting) or on the next import. Shopify's partner dashboard should then show 0 tokens to
migrate.

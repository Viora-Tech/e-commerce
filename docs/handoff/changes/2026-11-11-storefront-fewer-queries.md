# Storefront: repeated reads answered once per request

Roadmap, speed and memory track, step 3 (server's own time for an uncached page). Branch
`perf/storefront-fewer-queries`. No migration.

An earlier local audit counted about 44 store transactions for one uncached storefront page, with
the same rows read again and again: `store.apps` 14 times, the theme import record 7, the live
theme lookup 6, the policy page links 6. This change answers each of those once per request.

- **`@commerce/core/request-memo`** (`memoPerRequest`, `peekPerRequest`, `rememberPerRequest`,
  `setRequestMemo`). Off by default. The storefront turns it on in `lib/store-context.ts` with
  React's `cache(() => new Map())`, which React scopes to one server render: nothing outlives the
  render, and server actions, route handlers outside a render, the admin, the API and the worker
  always read the database. A failed load is forgotten, so the next caller tries again.
- **`storeAppsRow` / `storeAppsSettings`** (`packages/core/src/apps/store-apps.ts`): the
  read-only way to get the store's `apps` (and `storage`) record. The registries
  (`registriesForStore`, `installedStorage`, `appBlockSourcesForStore`, `appEmbedSourcesForStore`),
  theme packs, Delivery options, Pixels, GST invoices, COD & RTO, Affiliates, GrowthBook, Chatwoot,
  Reviews and Forms read through it. Writers still use `lockStoreApps`. Meilisearch's
  `loadMeilisearchEntry`, the worker's `installedApps` and the automations resolver were left
  alone (write paths or outside the storefront).
- **Render cache with no stamp** (`lib/store-cache.ts`): when the store has no stamp (caching
  off, the listener down, or just after a change), `cachedForStore`/`storeRead` used to load on
  every call. They now load once per request, and `peekForStore`/`rememberForStore` keep values
  for the rest of the request. That covers the live theme id, the theme import record, the Liquid
  data reads (pages, products, menus) and the rendered sections.
- **Liquid shop data** (`storeLiquidData` in core `theme-import/data.ts`): the store row and the
  policy links were read for every page context (one per section batch); now once per request.
- **Counting**: `STOREFRONT_TX_LOG=1` logs each transaction a render opens
  (`storefront transaction`, with a request id, its number and the calling frames), to count them
  on a real page.

Tests: `packages/core/src/apps/store-apps.test.ts` (14 reads of the record become 1 query; per
store; per request; failures retried), `apps/storefront/src/lib/store-cache-request.test.ts`
(no stamp: 6 live theme lookups and 7 theme import reads become 2 transactions; nothing kept for
the next request).

`STOREFRONT_REQUEST_MEMO=0` turns the memo off (kill switch, and how "before" was measured).

Measured 11 Nov 2026 on the local copy of Waimers (imported theme), `next dev`,
`STOREFRONT_CACHE_MB=0` (every page uncached), 6 warm requests per page, median of Next's
"application-code" time:

| Page | Transactions before → after | Server time before → after |
| --- | --- | --- |
| `/` | 35 → 20 | 905 → 829 ms |
| `/products/<handle>` | 43 → 27 | 1254 → 955 ms |
| `/collections/all-products` | 42 → 21 | 1225 → 886 ms |
| `/pages/home` | 39 → 20 | 928 → 724 ms |

The local database answers in well under a millisecond, so production (PgBouncer, network) should
gain more per transaction saved; dev-mode rendering dominates what is left locally. Still to do:
measure on the test server; the transactions that remain are mostly one per component (layout,
each Liquid section batch, app embeds, payments and shipping), which grouping could cut further;
the 0.2–0.4 s target needs the rendering time looked at too.

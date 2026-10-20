# Meilisearch search app

Branch `feat/app-meilisearch`. A `connection` app (`packages/plugin-meilisearch`, id
`meilisearch`, category `search`). Meilisearch is MIT (Enterprise Edition parts BUSL-1.1, not
used); it runs as a separate server and is called over its REST API with `fetch`, no client
library, no code copied. Radar row is now "In use".

- **Settings** (`store.apps.settings.meilisearch`, no migration): address, admin key and
  search-only key (encrypted with `SETTINGS_SECRET`, never returned), synonym groups, last
  sync time / count / error, pending reindex. Index per store `products_<storeId>`.
- **Search path**: new core hook `setProductSearchEngine` (`catalog/search-engine.ts`).
  `browseProducts` (with the new `storeId` input) and `suggestProducts(tx, q, limit, storeId)`
  take the engine's ranked ids (max 1000) and do filters, facet counts, sorts and paging on those
  ids in SQL, so RLS, prices and stock stay Postgres'. Falls back to the SQL search when no
  engine, not installed/connected/indexed, no match, an error, or over 300 ms; a failure cools that
  Meilisearch off for 30 s. Wired in the storefront search page and `/api/search/suggest`
  (`apps/storefront/src/lib/search-engine.ts`). Imported themes' Liquid `search`
  (#612) uses it too: `storeLiquidData` passes `storeId` to `browseProducts`.
- **Incremental sync**: outbox type `catalog.products_changed` (`productIds`), written by
  `noteProductsChanged` from create/update/archive/delete, bulk status/tags, the bulk editor,
  AI field writes and the product quick edits. The relay (now given an `{apps}-jobs` producer)
  queues `products.changed` for installed apps that declare it. Stock is not sent; availability
  is read live.
- **Full reindex**: app job `reindex` builds `…_rebuild` in batches of 500, swaps it in, then
  re-sends products edited during the run.
- **Index settings**: searchable title > vendor/type/tags > SKUs/options > handle/collections >
  description; typo tolerance (none on SKUs and handles); filterable available, price, vendor,
  type, tags, collections; sortable price, created_at, title; admin synonyms.
- **Admin**: Apps → Meilisearch (`components/apps/meilisearch/*`): address, admin key, Test
  connection (creates index + search-only key when the key may), documents, last update, last
  problem, Reindex now, synonyms editor. English + Hindi copy. `search` category label added.
- **Env**: `MEILISEARCH_TRUSTED_ORIGINS` (optional, private-network Meilisearch); added to
  `.env.example`, `deploy/env.production.example`, compose.
- **Docs**: merchant guide Apps → Meilisearch search (running it, keys, synonyms); developer
  docs Plugins paragraph; public App Store entry.
- **Tests** (pure, mocked fetch): `packages/plugin-meilisearch/test/*`,
  `packages/core/src/catalog/search-engine.test.ts`. Not run against a real Meilisearch.
- **Not done**: Meilisearch-side facet counts (facets come from SQL over the matched ids); a
  product deleted while a reindex runs stays in the index until its next change or reindex;
  collection membership changes alone do not re-sync (only used for Meilisearch filters, which
  the storefront does not use yet).

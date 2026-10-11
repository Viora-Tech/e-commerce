# Storefront render cache with instant invalidation (2026-10-11)

Store pages answered in 0.5 s (home, imported Zero Drift theme) to 0.2 s locally and 3 to 5 s in
production, with nothing cached. Now a cached page answers in about 20 ms locally; a page right
after a change renders once (about 0.35 s home) and is cached again. Full write-up: developer docs
`building/performance` → Caching.

- **Render cache** (`apps/storefront/src/lib/store-cache.ts`, in-process LRU, `STOREFRONT_CACHE_MB`
  default 48, 0 = off): store data reads (`storeRead`/`cachedForStore`), imported-theme sections and
  layout (`liquid-theme.ts`, keys in `liquid-cache.ts`), the theme's Liquid data
  (`liquid-data-cache.ts`), templates and their loops/sources/images, layout data, product /
  collection / search page data, reviews (shared part only). Never: carts with items, customers,
  checkout, account, previews.
- **Invalidation**: migration `0115_storefront_cache_notify` adds `storefront_cache_notify`
  triggers (`NOTIFY storefront_cache, '<store id>'`) on every rendered table
  (`packages/db/src/storefront-cache.ts`: `STOREFRONT_CACHE_TABLES`, `STOREFRONT_CACHE_EXEMPT`).
  The storefront LISTENs (`listenStorefrontCache`, reconnects with backoff; caching is off while
  disconnected). `media` writes are soft (applied at most once a minute). The store's next
  launch / scheduled article / discount start or end (`nextScheduledChange` in core) ends the
  version too. New table with a `store_id`: `packages/db/test/storefront-cache.test.ts` fails
  until it is classified.
- **CSP nonce**: Liquid renders write a random per-process placeholder; each request swaps in its
  own nonce.
- **Cart**: a Liquid section or layout that reads `cart` is cached only for an empty cart (a
  `Proxy` on the `cart` global traces reads). Sections reading `'now' | date` live 60 s (core
  `LiquidRuntime.onClock`), failed renders 30 s.
- **Warming** (`cache-warm.ts`, `recent-pages.ts`): after a change, the store's last 8 viewed pages
  are re-rendered 3 s after the writes stop (self-request to `127.0.0.1:$PORT`).
- **Fewer queries on a miss**: core `LiquidDataCache` batches products and collection products asked
  for in one render pass (`products`, `collectionsProducts`, `theme-import/product-data.ts`);
  `renderTemplate(storeId, key, options)` no longer takes a `tx` and opens short transactions only
  on misses (call it outside `inStore`). The not-found template no longer builds a Liquid context.
- **CDN**: `proxy.ts` + `lib/edge-cache.ts` send `public, max-age=0, s-maxage=30,
  stale-while-revalidate=300` on catalogue/content pages for visitors with none of our cookies
  (`STOREFRONT_EDGE_TTL`, 0 = private). Cloudflare cache rule documented in the performance page;
  DNS not changed.
- New env keys (optional): `STOREFRONT_CACHE_MB`, `STOREFRONT_EDGE_TTL` (compose, both examples).
- Known, not fixed here: Zero Drift's `product-tabs` section fails with "Maximum call stack size
  exceeded" in `blocks/_tab.liquid` (before this change too); it is now cached 30 s instead of
  re-failing on every request. HTML weight: an imported page still carries its Liquid HTML twice
  (DOM + RSC payload, about 105 KB gzip for the home page).

# Storefront caches: bounded, market-scoped, invalidated on save; one search engine per process

Branch `fix/storefront-cache-state`. No migration.

- **Host and market resolver** (`apps/storefront/src/lib/store-resolver.ts`): now an LRU of at most
  10,000 keys (`RESOLVER_MAX_ENTRIES`), built on `lib/lru-cache.ts`. Random Host headers from bots
  can no longer grow it without limit; misses are still cached. `forgetStore(storeId)` drops a
  store's answers and every miss; `clear()` drops everything.
- **One `storefront_cache` listener per process** (`lib/store-changes.ts`): a hub on `globalThis`
  that the render cache (`store-cache.ts`) and the proxy's small caches subscribe to. Host and
  market routing (`proxy.ts`), URL redirects (`lib/redirects.ts`, now LRU) and the password lock
  (`lib/storefront-gate.ts`) drop a store's entries on its next hard notification, and everything
  when the listener reconnects. Their TTLs (10 to 60 s) now only matter while the listener is down.
- **"Did you mean" vocabulary** (`packages/core/src/catalog/search-words.ts`): cached per store
  **and** request catalog (`app.catalog_id`), read only from products sold in that catalog (and
  never the system test product), so one market is never offered another market's words. Still
  capped at 500 entries (`VOCABULARY_MAX_ENTRIES`).
- **Search engine choice** (`packages/core/src/catalog/search-engine.ts`): the registered engine
  lives on `globalThis`, so every Next module graph in the process sees the same one. The
  storefront registers Meilisearch once at boot (`instrumentation.ts` →
  `lib/search-engine-register.ts`); later registrations change nothing. Per store, Meilisearch is
  still used only when the app is connected and indexed, with SQL as the fallback.
- Not changed: `apps/storefront-hono` keeps its own resolver TTLs (no listener there yet);
  `lib/referral-landing.ts` and `lib/experiments.ts` keep their short TTLs.

# Storefront server time: uncached pages about twice as fast (Speed step 3)

Roadmap Speed track step 3: uncached storefront pages took about 1.2 s of server time on
9–10 Nov. Profiled an uncached home, collection and product page on a production build
(`next start`, `STOREFRONT_CACHE_MB=0` so every read misses) against a copy of the dev Waimers
database (326 products, 1,134 variants, 61 collections, the imported Glide/Zero Drift Liquid theme),
with every statement logged by Postgres (`log_min_duration_statement = 0` on that database only)
and a V8 CPU profile over the inspector.

**What the time was.** Not SQL: every statement runs in well under a millisecond (`EXPLAIN
ANALYZE`); the logged "duration" of the big ones (16–19 ms) is Postgres waiting while Node, busy
rendering, reads the rows. The server was CPU-bound (busy 940 of 1,060 ms on home), mostly in
building products for Liquid:

1. The theme header previews three products for each of about 25 menu collections, and
   `collection.products` loaded the first 50 of each collection, fully (about 230 products with
   every variant, image and option), on every page.
2. `loadProducts` filtered every row list (options, images, variants, option values, variant
   images, memberships) once per product and once per variant: quadratic, 150 ms of a home render.
3. `ImageDrop`'s constructor sorted the media row's sized copies for every image, variant image
   and variant media of every product, every pass (90 ms).
4. `formatMoney` built a new `Intl.NumberFormat` per price (20 ms).
5. The collection list counted each collection's live products with a correlated subquery that
   scanned the product table once per collection (9 ms, growing with the catalogue).

**Changes.**
- `collectionsProductHandles` (core `product-data.ts`, `data.ts`, the storefront's
  `liquid-data-cache.ts` cache wrapper, `LiquidDataCache.collectionProductHandles`): a collection's
  product handles without the products. `CollectionDrop.products` returns `lazyProducts`: an array
  of the right length whose items load through the batched `product(handle)` read when a theme
  reads them. `.size` loads nothing; `limit:`, `offset:`, `.first` load only those; `map`, `where`,
  `json`, `paginate`, `all_tags` read every item as before. Sources without the method (tests,
  the editor) keep the old eager list. Costs one extra render pass for a section that reads products
  inside a collection.
- `loadProducts` groups its rows once (`groupBy`); same output, same order.
- `ImageDrop` takes its sized copies from `sizedCopies` (new `image-copies.ts`, a `WeakMap` per
  media row's variants).
- `formatMoney` keeps its formatters by locale, currency and decimals.
- The collection list's counts come from one grouped subquery, left-joined
  (`activeCollectionRows` in `product-data.ts`, which keeps `data.ts` under the 500-line sweep).

**Numbers** (median of 7, server time per request, same machine and data, cache off):

| Page | Before | After | Statements before → after |
| --- | --- | --- | --- |
| Home | 869 ms | 454 ms | 209 → 213 |
| Collection `mice` | 862 ms | 413 ms | 170 → 172 |
| Collection `best-sellers` | 790 ms | 379 ms | 176 → 178 |
| Product (33 variants) | 708 ms | 334 ms | 215 → 209 |
| Product (31 variants) | 719 ms | 347 ms | 215 → 209 |

CPU busy per home request (profiler on): 939 → 321 ms. Rows Postgres sent for products on a home
render: about 430 products → about 100. The rendered HTML is the same: saved before and after for
eight pages (home, three collections, three products, search) and compared after normalising
nonces, chunk names and slot ids; the only differences are the ones two renders of the same
build already have (the home page's random "perfect match" picks, the order of a few RSC rows).

**Dropped / not done.**
- No index migration: nothing in the three pages is slow in Postgres at this size (sequential scans
  of small tables, sub-millisecond). No migration number used.
- Fewer transactions per page (24 on home, each `begin`/`set_config`/`commit`): about 70 cheap
  round trips; left for later, small next to the CPU.
- Remaining CPU is mostly LiquidJS itself (`toValueSync`, about 50 ms of home) and row parsing.

**Tests.** `collection-products-lazy.test.ts` (no database): through the real engine, a menu
preview loads only the three products it reads, `.size` loads none, and the common ways of reading
the list (offset/limit, reversed, map, where, sort, last, index, json, all_tags/all_vendors, nested
`collections` loop, an empty collection, paginate) render exactly the HTML the eager list did.
`data-batch.test.ts`: `collectionsProductHandles` returns the same members as
`collectionsProducts`; collection counts count active products only and an empty collection zero.
Existing theme-import, variant-media, money and storefront liquid/store-cache tests pass.

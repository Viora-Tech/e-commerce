# Admin pages: what each one costs (November 2026)

Earlier work (#1321, #1328, #1333, #1338, #1344, #1352) made 8 of the 186 admin pages fast. This
sweep measures every page the same way, ranks them, and records the numbers the fixes are judged
against. Raw data: `2026-11-admin-pages-perf-before.csv` and `2026-11-admin-pages-perf-after.csv`
next to this file.

## How it was measured

- **Data.** A throwaway Postgres 17 and Redis in Docker, migrated, seeded with `bun run db:seed`,
  `db:seed:demo`, `db:seed:demo:marketing`, `db:seed:navigation`, then scaled up with
  `bun run --env-file=.env scripts/perf/seed-scale.ts`: 504 products (1,316 variants), 2,016
  customers, 5,068 orders over 180 days (about 10% cancelled), 10,096 order lines. Everything it
  adds is tagged `perf` and `--clean` removes it. It refuses a non-local database.
- **Server.** The admin in `next dev` (no production build on this machine), signed in as the
  seeded dev owner (`SEED_OWNER_EMAIL`) through the dev OTP route. The "before" numbers come from a
  clean `origin/dev` worktree, because `next dev` hot-reloads whatever is on disk.
- **Script.** `scripts/perf/admin-pages-chunked.ts` runs `scripts/perf/admin-pages.ts` over
  every `page.tsx` under `apps/admin/src/app`, restarting `next dev` every few pages (a dev
  server grows by about 0.5 GB per page it compiles) and stopping a chunk early when free memory
  drops below 1.5 GB. Dynamic segments are filled with seeded rows; pages with no row to open are
  listed as skipped. Each page is loaded once to compile and warm caches, then measured in
  headless Chromium:
  - **Server (doc) ms**: request start to the end of the streamed HTML, so when the server had
    finished every Suspense boundary. The main ranking number.
  - **Ready ms**: until the last request the page made had finished (client reads included).
  - **DB statements**: every statement Postgres logged between two marker queries
    (`log_statement = all`), including `begin`, `commit` and `set_config`; **Queries** leaves
    those three out.
  - **JS kB**: encoded size of the scripts the page loaded. In `next dev` these are unminified
    development chunks, so only the differences between pages mean something.
  - **Errors**: page errors, console errors and 5xx responses.
- **Re-running.** `bun run --env-file=.env scripts/perf/admin-pages-chunked.ts --port 3290
  --out <file>.csv [--checkout ../clean-worktree] [--only "regex"] [--runs 3]`, then
  `bun scripts/perf/admin-pages-report.ts before.csv [after.csv]` for the tables.
- **Noise.** Dev-server timings move by a few hundred ms between runs (compilation, garbage
  collection). Statement counts move too, less: the window also catches the page's client reads
  and any polling (Live view), and a run can catch a second prefetch. Before/after comparisons use
  three runs of each page and the fastest; compare the per-call costs in "What was wrong" for the
  exact effect of each fix.

## Coverage

All 186 `page.tsx` routes: 153 measured; 23 skipped because the seeded store has no row to open
(a blog post, segment, discount, return, shipment, gift card, transfer, purchase order...); the 5
`/platform` pages answer 404 to a store owner (they are for platform staff, as intended); 4 need a
signed-out visitor or a token (`/login`, `/oauth/authorize`, `/accept-invitation/[id]`,
`/onboarding`); and `/orders/drafts` answered 500 on every load (`createParser` from the client
`nuqs` entry called on the server; fixed in #1405).

## Before: the whole admin

One run per page on `origin/dev` (a31c5ce73): **mean 159 DB statements per page load (median 141,
min 55, max 750) and 0.8 s of server time.** Of those 159 statements, 31 are `begin`/`commit` and
31 are `set_config`: every admin call opens its own transaction and sets the store in it, and a
plain page (`/account/bug-reports`) already makes 22 of those calls. Single dev runs are noisy (a
page that recompiles shows 1.5 to 4.6 s), so the ranking below re-measures the 34 heaviest pages
three times and keeps the fastest run.

### The 20 slowest pages (fastest of three runs, before)

| # | Page | Server (doc) ms | Ready ms | DB statements | Queries | JS kB |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | `/` | 972 | 1725 | 311 | 215 | 2429 |
| 2 | `/apps/[pluginId]/[[...path]]` | 918 | 2099 | 135 | 83 | 3946 |
| 3 | `/customers` | 819 | 2494 | 316 | 200 | 2465 |
| 4 | `/analytics/live` | 777 | 6035 | 534 | 406 | 2293 |
| 5 | `/orders` | 612 | 876 | 143 | 83 | 2495 |
| 6 | `/products/bulk-write` | 572 | 1327 | 273 | 161 | 341 |
| 7 | `/stock` | 540 | 1077 | 256 | 152 | 539 |
| 8 | `/customers/[id]` | 503 | 1430 | 216 | 136 | 4064 |
| 9 | `/products` | 483 | 1156 | 156 | 92 | 2250 |
| 10 | `/customers/segments` | 476 | 863 | 119 | 71 | 1944 |
| 11 | `/apps/install` | 466 | 1205 | 280 | 176 | 234 |
| 12 | `/growth/links` | 444 | 1301 | 290 | 178 | 700 |
| 13 | `/content/metaobjects/new/blank` | 441 | 1056 | 118 | 70 | 2056 |
| 14 | `/products/[id]` | 424 | 2420 | 750 | 470 | 2935 |
| 15 | `/orders/[id]` | 414 | 1175 | 269 | 185 | 4196 |
| 16 | `/online-store` | 400 | 977 | 258 | 150 | 64 |
| 17 | `/markets` | 375 | 861 | 161 | 89 | 1963 |
| 18 | `/products/collections/[id]` | 369 | 1527 | 174 | 106 | 2668 |
| 19 | `/account/bug-reports` | 322 | 900 | 113 | 69 | 1923 |
| 20 | `/stock/transfers/new` | 315 | 860 | 261 | 153 | 609 |

The most DB statements per load (one run): `/products/[id]` 750, Home 477, `/stock` (Inventory)
373, `/settings/custom-data` 313, `/orders/shipments` 304, `/growth/links` 290, `/apps/install`
282, `/products/bulk-write` 273, `/orders/[id]` 269, `/settings/appearance` 268.

## What was wrong, and the fix for each

| Cause | Pages | Fix (PR) |
| --- | --- | --- |
| Home and Analytics loaded every order (14, 30, 90 days, a year and its comparison year), every order line and every variant into JavaScript and summed them there, about 30 reads one after another | Home, Analytics, Live view | Totals grouped in SQL, reads pipelined (#1399) |
| Home rebuilt all smart cards inside the request when they were 26 h old (45 to 135 ms on this store, more on a big one), although the worker does it hourly | Home | Home only reads the cards (#1399) |
| Every admin call ran two `set_config` statements | every page | One statement (#1400) |
| The layout made 7 separate store calls, so 7 transactions and 7 pool connections on every page | every page | One `store.shell` call (#1401) |
| `products.facets` read every product's vendor, type and tags to de-duplicate in JavaScript | product page, Products list | `select distinct` (#1403) |
| The product page's variant fields card sent one request per variant | product page | One call for all variants (#1402) |
| The Drafts list called a client-only nuqs function on the server and answered 500 | `/orders/drafts` | Parsers from `nuqs/server` (#1405) |

Not changed, measured:

- **Search** (`ilike '%...%'` on customers, products, orders): 2 to 14 ms at this size (2k
  customers, 5k orders). A `pg_trgm` index would help from tens of thousands of rows; not worth a
  migration and the extension yet. Revisit with Meilisearch (already an app) when a store gets big.
- **`loadEnv` per request**: 0.16 ms a call, a few calls a page. Not worth caching.
- **Customer segments**: the page reads every customer to count each segment's members in
  JavaScript (90 ms warm for 2k customers). Fine now; it grows with the customer count, so move
  the counting to SQL when segments get used on big stores.
- **Customer tags**: already `select distinct unnest(tags)`.
- **Theme code editor**: lists file paths and sizes only, never bodies; nothing to fix (no theme
  in the seed to measure).

## After: each fix on its own

Each PR branch checked out on its own over `origin/dev`, same six pages, fastest of three runs
(server ms, DB statements). `origin/dev`: Home 611 ms / 311, `/account/bug-reports` 202 / 113,
Analytics 392 / 156, Orders 613 / 143, Products 481 / 156, product page 402 / 750.

| PR | What moved |
| --- | --- |
| #1399 Home and Analytics in SQL | Analytics 392 → 316 ms; Home 611 → 592 ms (311 → 300). Services on their own: below |
| #1400 one `set_config` | `set_config` statements halve on every page: `/account/bug-reports` 113 → 102, Home 311 → 287, product page 750 → 680 |
| #1401 `store.shell` | 10 fewer transactions on every page: `/account/bug-reports` 113 → 96, Home 311 → 294 (ready 1,223 → 1,036 ms) |
| #1402 variant fields in one call | product page 750 → 380 statements, ready 2,769 → 1,714 ms |
| #1403 facets `select distinct` | no change beyond noise at 504 products; fewer rows read back on big catalogues |
| #1405 Drafts page | 500 → 200 |

Home and Analytics services, median of several runs against local Postgres:

| Read | 5k orders, before → after | 50k orders, before → after |
| --- | ---: | ---: |
| `dashboard.summary` | 79 → 76 ms | 311 → 284 ms |
| `dashboard.charts` 90 days | 21 → 18 ms | 139 → 109 ms |
| `dashboard.analytics` today | 27 → 28 ms | 39 → 35 ms |
| `dashboard.analytics` a year vs last year | 166 → 67 ms | 601 → 335 ms |
| `analytics.overview` 90 days | 155 → 49 ms | 448 → 294 ms |

With Postgres on the same machine a round trip is nearly free, so the pipelined reads and the
saved `set_config` and transactions show mostly as statement counts here; behind PgBouncer in
production each one is a real wait. At 50k orders the slowest statement left on Home is "orders to
ship, oldest waiting" (76 ms), because the synthetic seed leaves 40% of all orders open; a real
store has a few hundred open orders.

## After: the 34 heaviest pages, all fixes together

Fastest of three runs, `perf/admin-all-pages` (all the PRs above):

| Page | Server ms before → after | DB statements before → after |
| --- | ---: | ---: |
| `/` | 972 → 593 | 311 → 264 |
| `/account/bug-reports` | 322 → 190 | 113 → 90 |
| `/analytics/live` | 777 → 368 | 534 → 168 |
| `/apps/[pluginId]/[[...path]]` | 918 → 289 | 135 → 110 |
| `/apps/install` | 466 → 272 | 280 → 230 |
| `/content/metaobjects/new/blank` | 441 → 302 | 118 → 94 |
| `/customers` | 819 → 503 | 316 → 131 |
| `/customers/[id]` | 503 → 349 | 216 → 184 |
| `/customers/segments` | 476 → 290 | 119 → 95 |
| `/growth/links` | 444 → 298 | 290 → 238 |
| `/markets` | 375 → 291 | 161 → 131 |
| `/online-store` | 400 → 357 | 258 → 207 |
| `/orders` | 612 → 683 | 143 → 116 |
| `/orders/[id]` | 414 → 341 | 269 → 236 |
| `/orders/shipments` | 302 → 212 | 223 → 190 |
| `/products` | 483 → 450 | 156 → 130 |
| `/products/[id]` | 424 → 384 | 750 → 334 |
| `/products/bulk-write` | 572 → 550 | 273 → 223 |
| `/products/collections/[id]` | 369 → 343 | 174 → 145 |
| `/products/gift-cards/new` | 243 → 241 | 121 → 97 |
| `/products/preorders` | 276 → 245 | 124 → 100 |
| `/sales-channels/inbox/settings` | 309 → 212 | 118 → 94 |
| `/settings/appearance` | 263 → 230 | 268 → 218 |
| `/settings/checkout` | 201 → 194 | 175 → 146 |
| `/settings/costs` | 224 → 218 | 157 → 130 |
| `/settings/custom-data` | 204 → 226 | 313 → 270 |
| `/settings/domains` | 210 → 227 | 138 → 112 |
| `/settings/payments` | 218 → 237 | 161 → 134 |
| `/settings/payments/providers/[id]` | 237 → 223 | 161 → 134 |
| `/settings/staff/roles/[id]` | 275 → 255 | 141 → 115 |
| `/settings/taxes` | 239 → 236 | 176 → 148 |
| `/settings/templates` | 213 → 254 | 142 → 116 |
| `/stock` | 540 → 500 | 256 → 208 |
| `/stock/transfers/new` | 315 → 289 | 261 → 210 |

## After: the whole admin

The same one-run sweep over every route on `perf/admin-all-pages`
(`2026-11-admin-pages-perf-after.csv`):

| | Before | After |
| --- | ---: | ---: |
| Pages measured | 153 | 154 (Drafts loads now) |
| DB statements per page, mean | 159 | 126 |
| of them `begin`/`commit` | 31 | 20 |
| of them `set_config` | 31 | 10 |
| DB statements, median / worst page | 141 / 750 | 114 / 334 |
| Server ms per page, mean (one run, noisy) | 797 | 479 |

The server-time mean falls further than the fixes alone explain: single dev runs catch
compilation spikes, and the before sweep caught more of them. The statement counts are the
dependable number; the fastest-of-three tables above are the dependable times.

## Merge order

The PRs touch different files and can go in any order. Suggested: #1405 (Drafts 500, a plain
bug), #1401 (`store.shell`, every page), #1400 (one `set_config`, every page), #1399 (Home and
Analytics), #1402 (product page), #1403 (facets, smallest). #1401 and #1402 both add an entry to
the generated `packages/api/src/mcp/action-docs.generated.ts`; if the second one conflicts, run
`bun scripts/gen-mcp-action-docs.ts` on it after rebasing. This PR (scripts and numbers) goes last.

## Left to do

- **Batch the client's API calls.** Every client read is its own HTTP request, and each one looks
  up the session, the user, the membership and the grants again (5 statements) before its own
  transaction. Pages that read a lot from the browser (Live view, Customers, the order page) pay
  that 10 to 20 times. oRPC's batch plugin (client link plus handler) would let one request carry
  a page's reads and share one lookup. Needs a careful rollout (errors per call, streaming).
- **Pool size.** Still 10 connections per process. With the layout down to one call, a page opens
  about 7 fewer transactions at once; re-measure on production before changing it.
- **Customer segments** count members in JavaScript over every customer (fine at 2k customers).
- **Search** with `pg_trgm` or Meilisearch once a store has tens of thousands of rows.
- **Not measured** (no seeded row): 23 detail pages (a blog post, segment, discount, return,
  shipment, gift card, transfer, purchase order, a theme's code editor...). Seeding one of each
  would let the sweep open them.
- **Hydration warnings** (React regenerated the tree on the client) on `/markets/new`,
  `/settings/shipping/zones/new` and `/settings/shipping/zones/[id]`, before and after these
  changes. Not a speed issue; worth a bug of its own.
- **Production numbers.** These are `next dev` on a laptop. The admin performance doc's method
  (a production build against a copy of the Waimers database) would confirm them on the test
  server.

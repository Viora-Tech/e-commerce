# Search & discovery: analytics, boosts, picked recommendations (2026-10-31)

Issue #187. The Search & discovery app (`packages/plugin-search`) gains Overview, Boosts and
Recommendations pages; Synonyms moved from `/apps/search` to `/apps/search/synonyms`.

## Data (migration 0209, `packages/db/src/discovery-schema.ts`)

- `discovery_event`: one search, impression, click, add or checkout. `session_key` is
  `sha256("discovery:<store>:<wc_vid>")[0:32]`, never the raw visitor id; no IP, no customer.
  `query` is normalised (`normaliseSearchQuery`) and dropped when it looks like an email or a
  phone number (`loggableQuery`). Deleted after 90 days by the retention job
  (`deleteOldDiscoveryEventBatch`; `stores_with_retention_due` replaced in 0209).
- `search_pin` (term → product, ordered), `search_boost` (tag / type / vendor → boost / bury),
  `product_recommendation` (product → picks per intent). All three carry
  `storefront_cache_notify`; all four get RLS via `apply_store_rls()`.
- `scripts/reset-store-data.ts` wipes `discovery_event`, `search_pin`, `product_recommendation`
  (boost rules are settings and stay). `anonymise.ts` notes there is nothing customer-linked.

## Core (`packages/core/src/discovery/`)

- `query.ts` (pure, `@commerce/core/discovery`): normaliser, limits, Overview types,
  `splitSearchLists`.
- `boosts.ts` (pure): `compileBoosts`, `searchRank`, `comparePinned` (the JS twin of the SQL).
- `boost-sql.ts`: pin position (`array_position`), pinned ids joining the matches, and the
  rank change from `p.tags && array[…]`, `p.product_type = any(…)`, `p.vendor = any(…)`: row
  columns only, no per-row subquery. `browse.ts` `baseQuery` adds them for searches;
  `orderBy('relevance')` is now `b.pin nulls last, b.relevance, …`. Boosted = 2 tiers up,
  buried = +1000. With Meilisearch, relevance is the engine's position, so a boost moves a
  product 2 places.
- `service.ts`: event writes (search and impression deduped per session within 30 minutes;
  add and checkout are conditional inserts that only write when the session clicked / added in
  the last 30 minutes), boosts / pins / picks CRUD, `discoveryOverview` (funnel chained
  search → click → add → order, each within 30 minutes of the step before).
- Imported themes: `theme-import/data.ts` `relatedProducts` uses our picks before the imported
  `shopify--discovery--product_recommendation` metafields.

## Storefront

- `/api/beacon` accepts `{ discovery: {...} }` (same consent gate, IP-rate-limited, written in
  `after()`, no visit counted). `lib/discovery-beacon.ts` sends with `sendBeacon` and checks
  the consent cookie first.
- `components/analytics/search-beacon.tsx` on the search page (query + total).
- `components/analytics/discovery-tracker.tsx` (mounted with `VisitBeacon`): passive capture
  click listener for result and recommendation clicks; IntersectionObserver for rows seen on
  product pages (`[data-recommendations]` on our section, `product-recommendations` on imported
  themes).
- `addLineAction` and the thank-you page record add / order in `after()`.
- `RelatedProducts` puts the picks first; `ProductRecommendations` takes `intent`.

## Admin and API

- `search.overview`, `search.boosts.{get,setRules,setPins}`,
  `search.recommendations.{list,get,set}` (`packages/api/src/routers/search.ts`).
- Pages under `apps/admin/src/components/apps/search/`; copy `data/search-discovery.ts` + Hindi.

## Tests

`discovery/query.test.ts` (normaliser, personal-data filter, list split) and
`discovery/boosts.test.ts` (compile, rank order, SQL has no subquery).

## Left out

- Predictive (header) search clicks are not counted as search clicks.
- Our own theme has no "Pairs well with" section, so complementary numbers come from imported
  themes only.
- Pins and boosts apply to search only, not collection pages.

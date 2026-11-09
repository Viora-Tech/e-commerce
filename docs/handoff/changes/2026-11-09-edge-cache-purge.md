# Longer edge cache for store pages, purged on change; theme drafts stop clearing the page cache

Measured on www.waimers.in (9 Nov): an origin render-cache hit answers in 0.16-0.25 s, a miss in
0.8-1.6 s (home, collections, cloud-3950), and 348 of 353 audit fetches missed Cloudflare
(`s-maxage=30`). Two causes are addressed here.

- **Theme drafts no longer flush the store's cache** (migration `0232_storefront_cache_quiet_drafts`):
  Customize saves `theme_template.draft` 600 ms after every change and Edit code saves
  `theme_file.draft_body`; each write sent `storefront_cache` and dropped every cached page of the
  store (and re-rendered its recent pages), so pages stayed uncached while anyone edited any theme
  (the activity log shows draft saves on 8 Nov). Those triggers now fire on the shopper-facing
  columns only (`UPDATE OF ...`, as 0224 did for pixels); Publish still notifies. Test in
  `packages/db/test/storefront-cache.test.ts`.
  **Order:** journal `when` is after #1333's `0231_admin_list_indexes`; merge #1333 first (or
  re-time this entry) so drizzle does not skip 0231.
- **Edge purge (worker)**: `apps/worker/src/edge-purge.ts` listens on the same channel and purges
  a store's active hostnames from Cloudflare (`purge_cache {hosts}`) ~5 s after its writes settle,
  at most every 30 s per store; soft (media) writes after the origin's 60 s delay; the whole zone
  30 s and 120 s after a storefront starts (`announceStorefrontStart` in `instrumentation.ts`:
  cached HTML from an old build points at missing chunks) and after a listener reconnect.
  Timing rules: `EdgePurgePlan` in `packages/core/src/domains/edge-purge.ts` (tested). Off unless
  `CLOUDFLARE_CACHE_PURGE_TOKEN` (new env, worker only, "Zone > Cache Purge" on the SaaS zone).
- `lib/edge-cache.ts`: stale-while-revalidate is ten TTLs capped at an hour.
- Default `STOREFRONT_EDGE_TTL` stays 30. Owner: add the token + `DATABASE_URL_DIRECT` to the
  worker, deploy, then set `STOREFRONT_EDGE_TTL=600` on the storefront.
- Not changed: a shopper who answered the cookie banner carries `wc_consent` (and with analytics,
  `wc_vid`/`wc_ses`), so the edge never serves them a cached page; see the report for why that
  needs consent read in the browser and experiment-aware caching first.

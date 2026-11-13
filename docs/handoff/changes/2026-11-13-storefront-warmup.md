# Storefront warm-up after a deploy (13 Nov 2026)

After each storefront deploy the first shoppers waited 4–12 s while the new process warmed up.
The worker now listens for storefront starts (the `storefront_cache` start notice the storefront
already sends for the edge purge) and, 15 s later, loads each live store's `/` and
`/collections/all` once, one page at a time, with a query string so the edge passes them to the
origin. Production only. Logged as `storefront warmed` (hosts, ok, failed, ms).

- Migration `0245_live_storefront_hosts`: SECURITY DEFINER `live_storefront_hosts()` (primary,
  active hostnames, at most 50) granted to `app`; `liveStorefrontHosts(db)` in @commerce/db.
- `apps/worker/src/storefront-warmup.ts` + test.

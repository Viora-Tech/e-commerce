# SEO check on Store health, and IndexNow auto-notify (22 Nov 2026)

Two SEO helps that need nothing from the merchant.

## A. Settings → Store health › SEO

A new card under the severity cards, loaded when the page opens (Check again re-runs it). It counts,
over live products, active collections and published pages:

- no search description (no SEO description and no description text),
- titles under 15 characters (or missing),
- duplicate titles (within products, collections or pages),
- product photos without alt text (products and photo total),
- product handles ending in `-copy` / `-copy-2` (left by Duplicate).

Each failed check names its first five items (links to their edit pages) and links to the full
Online store › SEO report. Read only. The rules are the SEO report's own (`seo/checks.ts`), so the
two never disagree.

Skipped: "expired sale collections still visible". Collections have no end date or schedule, so
there is no reliable signal.

- `packages/core/src/store-health/seo-health.ts` (+ test), subpath `@commerce/core/seo-health`.
- `loadSeoHealth` in `packages/core/src/seo/service.ts`; api `seo.health` (SETTINGS_READ).
- `apps/admin/src/components/store-health/seo-health-card.tsx`, copy `data/seo-health.ts` + Hindi.

## B. IndexNow (Bing, Yandex, Seznam, Naver)

- **Key**: 32 random hex characters, made the first time a store pings, kept at
  `store.preferences.indexNow.key` (a top-level entry that saving Preferences leaves alone). No
  migration.
- **Key file**: `/<key>.txt` on the store's domain. `lib/routing.ts` rewrites that exact pattern to
  `app/-s/[storeId]/indexnow/[key]/route.ts`, which answers the key as text, or 404 for any other key.
- **Sweep** `indexnow` (`apps/worker/src/indexnow.ts`), every 5 minutes, production only:
  for each live primary host (`liveStorefrontHosts`, max 50), if the primary domain is `custom`,
  active with an active certificate, and the store is indexable (no password page, search engines
  on), it sends the paths of products (active or archived), active collections and published pages
  whose `updated_at` is after the last run, plus deleted paths, in one batched POST (10,000 URLs max
  per body) to `https://api.indexnow.org/indexnow`. The first run per store only sets the cursor
  (Redis `indexnow:since:<store>`), so a deploy does not announce the whole catalogue. A failed POST is
  logged (`indexnow failed`, with statuses) and not retried.
- **Deletes**: `deleteProduct`, `deleteCollection` and `deletePage` write a `seo.paths_removed`
  outbox row (only for something that was live). The relay pushes those paths to Redis
  `indexnow:removed:<store>` (capped 10,000, kept a day) for the next run.
- **Off switch**: none added. Preferences › search engines off, or the password page, stops it.

Not covered: unpublishing a page or setting a product back to draft is not announced (the next
crawl finds the 404). Stores past the first 50 live hosts are not swept (raise the limit in
`live_storefront_hosts` if that day comes).

Check after deploy: open `https://www.waimers.in/<key>.txt` once the key exists
(`select preferences->'indexNow' from store`), and look for `indexnow sent` in the worker logs after
editing a product.

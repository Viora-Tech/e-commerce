# Google Search Console app

Branch `feat/google-search-console`. A `connection` app (`packages/plugin-search-console`, id
`google-search-console`, category `analytics`, by Google; credited as "Google Search Console API",
no Google code or client library bundled: plain `fetch`). **Migration `0119_search_console`**
(table `search_console_row`, function `stores_with_search_console_due()`, ends with
`apply_store_rls()`; `when` chains after `0118_seo_keywords`).

- **OAuth client**: new optional `GSC_GOOGLE_CLIENT_ID` / `GSC_GOOGLE_CLIENT_SECRET`; both blank
  falls back to `MERCHANT_GOOGLE_CLIENT_ID` / `_SECRET` (the admin's Google sign-in client). Own
  keys are recommended: `webmasters` is a sensitive scope, so Google's consent-screen verification
  applies to the project that asks for it, and a separate project keeps sign-in untouched by it.
  Redirect URI: `<ADMIN_URL>/api/apps/google-search-console/oauth/callback`. Added to `env.ts`,
  `.env.example`, `deploy/docker-compose.prod.yml`, `deploy/env.production.example`.
- **Connect**: `searchConsole.connectStart` (`settings.manage`) → Google consent (scopes `openid
  email webmasters`, offline, `prompt=consent`, PKCE S256). `state` = HMAC(`SETTINGS_SECRET`) over
  store id + nonce + 30 min expiry; the PKCE verifier is HMAC(secret, nonce), so nothing is stored
  between start and callback. Callback route `apps/admin/src/app/api/apps/google-search-console/
  oauth/callback/route.ts` → `searchConsole.connectComplete` (`settings.manage`, state must be this
  store's). Refresh token saved as an `encryptSecret` blob in `store.apps.settings
  ['google-search-console']` (rotated by `rotate-secrets` like Umami's key). Disconnect revokes at
  Google, clears the settings and deletes the rows. Scope is `webmasters`, not `.readonly`, because
  sitemap submit needs it.
- **Property**: `searchConsole.properties` (`sites.list`, sorted, unverified marked unusable) with
  `suggested` = the property covering the store's live domains, primary first (domain property >
  https prefix > http). `chooseProperty` checks the account can read it, clears rows, syncs inline.
- **Data**: core owns the table and every query (`packages/core/src/search-console/service.ts`;
  pure rules in `insights.ts`, client-safe subpath `@commerce/core/search-console`), because the
  SEO report and product card read it and core cannot import a plugin; this also keeps every new
  file off the service-layer allow-list. Rows: `current` (28 days ending 3 Pacific days ago) and
  `previous` (the 28 before) × `total`, `page` (1000), `query` (1000), `device`, `country` (250);
  `page_query` (5000) for `current` only. Page URLs map to a lowercase `path`
  (`/collections/x/products/y` → `/products/y`), matched to product/collection/page handles.
- **Sync** (`plugin-search-console/src/server.ts` `syncSearchConsole`): settings read in one
  transaction, Google asked outside any (11 queries in parallel, 20 s timeouts), rows replaced in
  another only if token and property are unchanged. Failures saved as `lastError`; Google's
  `invalid_grant` / 401 sets `reconnect`. One `store.apps` write per sync (outcome and
  `attemptedAt` together), because every `store` row write also drops that store's storefront
  cache (0115 trigger): so about one cache drop per store per day, plus one per "Refresh now". Worker: `apps/worker/src/search-console.ts`, hourly
  `{search-console}-sweep` queues the app job `sync` for stores whose `attemptedAt` is over 20 h old
  (so a store Google refuses retries daily, not hourly). "Refresh now" (`searchConsole.refresh`,
  `online_store.write`) runs the same sync in the request, at most once per 15 minutes.
- **Admin** (Apps → Google Search Console): Overview (clicks, views, click rate, position with %
  change; top searches/pages, devices, countries), Top searches, Top pages (linked to the item),
  Almost page 1 (position 8–20, ≥100 views, "Improve" → product SEO tab), Losing traffic (pages and
  searches), Sitemaps (live `sitemaps.list`, submit `/sitemap.xml` on the property's host or the
  primary domain), Settings (connect, property picker, last update). Product SEO tab: "Google search"
  card (`searchConsole.product`, from `searchStatsForProduct(tx, storeId, productId)`). Copy in
  `data/search-console.ts` + Hindi.
- **SEO report**: `loadSeoReport(tx, storeId)` attaches each item's 28-day numbers when the app is
  installed and has rows; new kinds `low_ctr` (medium; many views near the top, under half the usual
  click rate) and `almost_page_one` (low), both Fix with AI → `seo`, both **left out of the score**.
  Not connected: nothing changes.
- **Keywords hook**: core registers the stored per-page searches with `setSearchQueriesSource`
  (`seo/search-queries.ts`, from #496), so "Suggest keywords" uses real Google searches once
  connected.
- **Permissions**: reads `online_store.read`; connect, disconnect, properties, choose
  `settings.manage`; refresh and sitemap submit `online_store.write`. Cross-store walk skips the
  procedures that reach Google.
- Tests written, not run (owner rule): `packages/core/src/search-console/insights.test.ts`,
  `packages/core/src/seo/checks.test.ts` (search signals), `packages/plugin-search-console/test/
  {settings,server,google}.test.ts`. No Google calls were made; endpoints follow Google's docs.
- Docs: merchant guide Apps → Google Search Console, App store table; developer docs Plugins.

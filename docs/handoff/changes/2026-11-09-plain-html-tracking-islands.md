# Plain HTML pages: Pixels app, experiments and discovery as islands (9 Nov 2026)

Phase 2 of `docs/design/storefront-plain-html.md`, first part. Builds on #1367.

- **Island modules:** small plain-JS files the inline island loads only when needed
  (`lib/plain-html/modules.ts`), served at `/api/islands/<name>.js?v=<hash>`
  (`app/api/islands/[file]/route.ts`; the current hash is cached for a year, anything else for a
  minute). Each registers with `window.__commerceIsland(name, fn)` and gets its config and the
  island's helpers (`send`, `inline`, `external`, `idle`, `nonce`). Loaded as a nonced module
  script, so `strict-dynamic` lets it run. No framework.
- **Pixels app** (`pixels-module.ts`, 2.9 KB raw): after a yes to marketing, on idle: fbevents.js
  with every pixel, a PageView, then every `commerce:track` event (and any queued before it
  loaded), to the browser pixels and `/api/px` with one event id, exactly as `PixelEvents` +
  `lib/pixels/track.ts` (same custom data, matching fields, `atc_` ids, Purchase rule, private
  paths; `pixels-module.test.ts` checks them against `track.ts`). With the app installed the
  legacy Meta pixel is not started, as on the React page. No longer a skip reason.
- **Experiments (GrowthBook):** a page drawn with experiments sends "experiment viewed" to
  `/api/experiments` once (as `ExperimentBeacon`). Sections in an A/B test no longer send the
  page back to React: `templateSections` already picked the shopper's variant. No longer a skip
  reason. The theme A/B rollout (`theme-ab-test`) still is (only Treatment visitors).
- **Search & discovery:** a click on a product in a theme's recommendation row is counted
  (`DiscoveryTracker`'s click rule), after a yes to analytics.
- **New skip reason `app-block`:** a section with one of our app-block slots
  (`data-commerce-app-block`, the reviews carousel React portals into) goes back to React, which
  phase 1 missed (the slot stayed empty on the plain page).
- `PRIVATE_PREFIXES` is exported from `lib/tracking-paths.ts` for the module.

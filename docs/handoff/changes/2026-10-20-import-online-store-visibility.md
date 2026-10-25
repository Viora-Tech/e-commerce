# Shopify products off the Online Store import hidden

Branch `fix/import-unpublished-visibility`. No migration. Snapshot format 3 (older preview copies
are read again from Shopify).

- **Bug (Waimers).** After a Collections import, `/collections/atk` showed 28 products vs
  Shopify's 24 and `/collections/keyboard` 22 vs 18. The extras are
  `atk-rs6-air-esports-hall-effect-keyboard`, `atk-rs6-plus-series-aluminum-magnetic-switch-keyboard`,
  `atk-rs63-air-esports-hall-effect-keyboard` and `atk-rs7-air-esports-hall-effect-keyboard`.
  waimers.in 404s them but they were live here. `best-sellers` (241 vs 238) has the same 4 extras.
  It is also missing `atk-blazing-sky-x1-v2-series-esports-wireless-mouse`, which Shopify changed
  after the import ran.
- **Cause.** Products were mapped from Shopify `status` only. An ACTIVE product that is not on the
  Online Store sales channel is hidden on Shopify but became `active` here. Collection membership
  (Admin API) includes them, so they showed in collections. The CSV reader ignored `Published` when
  `Status` was present, so it had the same gap.
- **Fix.** Products now read `publishedAt`, which Shopify leaves null when the product is not on the
  Online Store. `productStatus` maps ACTIVE with null `publishedAt` to `draft`, but only when the
  shop publishes some product to the Online Store (`sellsOnOnlineStore`, one
  `published_status:published` query). A headless shop keeps its active products active. In CSVs,
  `Status=active` with `Published=false` reads as draft. `SNAPSHOT_FORMAT` is now 3.
- **Data.** Run a Shopify import with **Products** selected (not "Import remaining"). The RS
  keyboards then become draft and leave every collection. The same run picks up the x1 change.
- Tests: `test/online-store-visibility.test.ts` (API with and without an Online Store, the status
  map, CSV).

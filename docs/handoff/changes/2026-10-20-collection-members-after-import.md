# Products imported after their collections join them

Branch `fix/collection-missing-products`. No migration.

- **Bug (Waimers).** `/collections/mice` showed 77 products against Shopify's 82. Missing:
  `atk-a9-nb-lightweight-wireless-mouse`, `atk-phantom-carbon-fiber-composite-mouse`,
  `vxe-dragonfly-r1-series-wireless-mouse-1`, `vxe-dragonfly-v3-series-mouse`,
  `vxe-dragonfly-x3-series-mouse`. All are imported and live (`/products/<handle>` 200, found by
  search); they are just not members. Same gap in `atk` (5 vs 24), `keyboard`, `accessories`,
  `mousepads`, `cloth-mousepads`, `glass-mousepads`, `best-sellers`: every product created on
  Shopify on 12–13 Oct, after the first import.
- **Cause.** Membership is written only by `writeCollection`. "Import remaining" skips collections
  that are already here (`remainingFilter`), and when only products are left it does not read
  collections at all; a retry or a products-only import does the same. So a product imported
  after its collections never joined them (and automatic collections were not re-matched).
- **Fix** (`read-write.ts` `joinCollections`, `write-content.ts` `linkCollectionMembers`). When a
  real API run wrote products but did not rewrite every collection from Shopify (narrowed run,
  collections not selected, or collections taken from a preview copy), it re-syncs automatic
  collections and reads collections fresh from Shopify, adding the products it wrote to the
  manual collections that list them, after the existing members. Add-only, and only the
  products this run wrote: a product the merchant removed from a collection here stays out. A
  failure is one issue on the run, not a failed import.
- **Waimers data.** The fix does not re-run itself: the merchant should run an import with
  **Collections** selected (not "Import remaining") to refresh every collection's membership
  from Shopify. That also brings in `victory-season-sale` (404 here) and drops products Shopify
  has since taken out of `preorder`.
- Not bugs: handles with CJK characters are slugged without them (`wlmouse-ying-影-…` →
  `wlmouse-ying-…`, with a redirect). Search "pulsar": the 7 extra Shopify hits (e.g.
  `es-saturn-pro-gaming-mousepad`, the Demon Slayer ES2 pads) do not contain "pulsar" in title,
  vendor, type, tags, body or variants; Shopify matches them through fields we do not index.
- Tests: `test/collection-members.test.ts` (Import remaining and products-only runs; merchant's
  removal respected; automatic collection re-matched; no duplicates). The fake Admin API
  answers `Collections` with none.

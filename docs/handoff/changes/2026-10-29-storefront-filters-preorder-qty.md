# Storefront filter settings (#938) and pre-order quantity (#939)

Branch `feat/storefront-filters`. **No migration**: the settings live in
`store.preferences.storefrontFilters` (JSON), like `searchSynonyms`.

## #938 Filters like Shopify's Search & discovery

- **Settings** `packages/core/src/catalog/filter-config.ts` (pure, `@commerce/core/filter-config`):
  `{ groups: [{ source, key?, label? }] }`, sources `availability | price | option | metafield |
  tagGroup | productType | vendor | giftCard | tags`. `resolveFilterGroups(facets, config,
  surface)` gives the ordered groups both storefronts draw; `null` config = today's defaults
  (theme: availability, gift card kind, price, options, marked fields, type/brand when 2+, first
  30 tags; Liquid: the same without kind and tags).
- **Tag groups**: tags `hand-large` → group `hand`, value `large`, label "Large". New URL param
  `filter.p.tag.<prefix>=<value>` (`BrowseFilters.tagGroups`), AND across groups, OR within,
  case-insensitive. `pickedValues` / `withValues` in `browse-params.ts` read and write any filter
  slot (used by the theme form, chips and `liquidFilters`).
- **Browse**: `browseProducts` reads the settings when given `storeId` (the collection page now
  passes it) and returns `filterConfig`. With settings, metafield facets and filters use exactly
  the fields the settings name (no "Use as filter" mark needed); a metafield param the settings
  no longer name is ignored rather than emptying the page.
- **Admin**: Search & discovery app → new **Filters** page (`components/apps/search/filters-page.tsx`,
  add dialog, no drawer). API `search.filters.get` (config + `filterSources`) and
  `search.filters.set({ config | null })`, both need the app installed (as synonyms do). The
  storefront applies saved settings whether or not the app is still installed.
- **Storefronts**: `filter-form.tsx` and `liquidFilters` both use `resolveFilterGroups`;
  `LiquidBrowseData.filterConfig` carries the settings into `collection.filters` / `search.filters`.
- Merchant guide: `apps/docs/content/merchant-guide/apps/search-and-discovery.mdx`.

## #939 Quantity on pre-order pages

- Product page shows the quantity picker on a pre-order (Buy it now stays hidden). Cap =
  stock + `preorderRoom` (new optional `ProductDetail.variants[].preorderRoom`, from
  `apps/storefront/src/lib/catalog.ts`; null = no limit = no cap). A quantity picked on another
  variant is clamped to the new one's cap.
- Server: `addToCart` / `setLineQuantity` clamp a pre-order line with a limit to stock + room
  (`preorderCap` in `core/cart/cart.ts`); an add with no room at all throws `OutOfStock`.
  `placeOrder`'s reservation still enforces the limit at checkout.

Tests: `catalog/filter-config.test.ts`, `catalog/browse.test.ts` ("storefront filter settings"),
`theme-import/liquid-filters.test.ts`, `order/preorder.test.ts` ("pre-order quantity in the
cart"), `packages/blocks/test/product-buy-buttons.test.tsx`.

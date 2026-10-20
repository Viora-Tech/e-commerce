# Liquid theme data gaps (Waimers / Zero Drift on Koomerce)

Compared waimers.in (Shopify) with waimers.koomerce.app section by section, using the Zero Drift
theme export (5 Oct 2026) as the Liquid source.

## Fixed

- **`product.collections` was always `[]`.** `ProductDrop` now lists the active collections a
  product is in (`LiquidProductData.collectionHandles`, loaded with the product in
  `product-data.ts`, one extra query per batch). The theme's product "Accessories" tab
  (`snippets/product-add-ons.liquid`) picks its rows from the product's kind of collection
  (`mice`, `keyboard`, `mousepads`) and its brand collections. With no collections it rendered
  nothing. Tests: `theme-import/product-collections.test.ts`.
- **`/recommendations/products` returned 404.** The theme asks for
  `section_id=template--…__related`. The key `related` is not a section type (the type is
  `related-products`), so `renderStaticLiquidSection` found nothing. It now looks up the
  section placed under that key in the path's template, with that section's own settings. For
  recommendations the path is the product's own page, so `product` is in scope as on Shopify.
- **`collections.all` order.** Shopify reads it A to Z by title. We read it newest first, so the
  empty-cart "Bestsellers" row (theme setting unset, so `collections.all`) showed other products.
  Both `all` paths (`data.ts`, `product-data.ts`) now sort by title.
- **Home "Shop the range": first tab label blank.** The server HTML was correct. Our own blocks
  CSS (`packages/blocks/src/styles/section-tabbed-products.css`, the 17 Oct Figma restyle) loads
  on every storefront page and uses the theme's class names. It set the selected label to
  `--color-ink`, and the theme's sliding pill is also `--color-ink`, so the label was ink on ink.
  The Figma overrides now skip anything inside `.shopify-section`, which only imported Liquid
  sections use. The other Figma overrides from that commit (product card, price, section
  heading, category panels, promo bento) leak into imported themes in the same way. None of
  them hid content, so they are left as they are. Worth scoping the same way later.

## Not code (data)

- **Every product on waimers.koomerce.app reads sold out** (12 of 12 cards on the home page;
  Shopify shows 2 of 12). Liquid `available` is sellable stock at `fulfils_online` locations, or
  pre-order. The store's inventory or locations need checking. Until then, related products and
  add-ons (both drop unavailable products) stay empty even with the fixes above. Pre-order
  products also show "Sold out" rather than "Pre-order".
- **Home "Next drops" shows 4 cards, Shopify 1.** The section reads Roadmap entry metaobjects
  with "Show on home page" ticked (`snippets/roadmap-order.liquid`), up to 4. The engine applies
  that filter correctly (checked with the theme's own snippet). Koomerce's entries are an older
  copy: "Waimers 2.0!", "Wooting 60HE v2 restock" and "Hachiware Glasspads" no longer exist on
  Shopify. Re-importing the metaobjects fixes it.
- `/pages/roadmap` on Koomerce draws our default page, not the theme's `page.roadmap` template.
  That is template suffix handling (see the import-template-suffix change).

## Search & Discovery recommendations

Search & Discovery keeps a product's hand-picked recommendations as product metafields in
`shopify--discovery--product_recommendation` (`related_products`, `complementary_products`,
lists of product references). The importer does not skip that namespace, and stores it as
`shopify_discovery_product_recommendation`. `relatedProducts(productId, limit, intent)` now
reads them:

- `intent=related` (the default): the picks first, then shared collection, type and tags.
- `intent=complementary`: the picks only, as on Shopify.

Available products only. The `/theme-actions/recommendations` route (the shim's
`/recommendations/products`) passes `intent` through and sets `recommendations.intent`. Tests:
`pickedRecommendationIds` in `forms-and-related.test.ts`.

## Metafield filters (Hand size, Grip, Weight, Switches, Connection)

Shopify's filter list lives in the Search & Discovery app and is not in the Admin API. The
filters themselves are product metafields. Collection and search listings (`browse.ts`) now
offer product extra fields as filters:

- Types: short text, choice and number fields with storefront access.
- A field shows when it has 2 to 25 values in the listing and its values repeat (on average 1.5
  products per value). A per-product spec line therefore never shows.
- URLs use Shopify's shape: `filter.p.m.<namespace>.<key>=value`. Namespace and key are mapped
  to the stored keys, so `filter.p.m.custom.filter_grip=Claw` works as on waimers.in.
- The filter drawer adds one group per field, named after the field. Chips remove one value.

Tests: `catalog/browse-metafields.test.ts` (params and the field selection). The SQL (facet
counts, `exists` filter) has no database test here; there was no local Postgres. Run
`browse.test.ts` against a database before merging. The rule decides from values, not from a
merchant's choice. If a store sees an unwanted group, the next step is a "use as filter" flag on
extra-field definitions (set by the importer when it can tell).

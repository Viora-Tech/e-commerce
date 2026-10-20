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

## Not done: metafield filters (Hand size, Grip, Weight, Switches, Connection)

Shopify's filters come from Search & Discovery: product metafield definitions an admin marks as
filters. That configuration is not in the theme export. Our collection page (`MainCollection`,
`packages/core/src/catalog/browse.ts`) has facets for availability, price, type, vendor, tags
and options only. Adding these filters would need:

1. A "use as filter" flag on product extra-field definitions (schema and admin toggle), set by
   the Shopify importer when it can read the store's filter list.
2. Facet counts and `filter.p.m.<namespace>.<key>=value` params in `browse.ts` /
   `browse-params.ts` over the stored extra-field values (single-line text, choice, boolean,
   number, and lists of them).
3. Filter groups in the MainCollection drawer, named after the definition.

That is a feature of its own, not a data fix.

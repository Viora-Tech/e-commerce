# Metafield filters (Search & Discovery parity) and scoped blocks CSS

Also carries the Search & Discovery recommendations commit that missed #603's merge.

## "Use as filter" on product extra fields

- Migration `0139_metafield_filterable`: `metafield_definition.filterable boolean not null
  default false`. Its journal `when` is later than 0138's on the shared test database. Drizzle
  skips a migration older than the last one applied, so keep it later if 0138 is renumbered.
- `canFilterBy` / `FILTERABLE_FIELD_TYPES` (`metaobjects/schemas.ts`): product fields of single
  line text, choice, integer, decimal or yes/no, as single values or lists. The write schema's
  `filterable` is optional. A new field defaults to off; an edit without it keeps the stored
  value.
- Admin: Custom data → product field dialog has a **Use as filter** toggle (filterable types
  only), and the list shows a **Filter** badge. Copy is in `data/metaobjects.ts` and the Hindi
  overlay.
- Merchant guide: Products → Extra fields → "Filter by an extra field".

## Catalogue filters

- `browse.ts`: facet counts per filter field (`facets.metafields`: key, name, type `list` or
  `boolean`, values). Until a store marks any product field "Use as filter", fields of a
  filterable type are guessed from their values: 2 to 25 values of up to 60 characters,
  shared by 1.5 products each on average. Existing imported stores therefore lose nothing.
  Once any field is marked, only marked fields show and filter.
  Yes/no reads `1` / `0`, as Shopify's boolean filters do. Filter:
  `filter.p.m.<namespace>.<key>=value` (Shopify's shape; `hand-size` maps to `hand_size`), OR
  within a field, AND across fields. Availability, price, type, vendor, tags and options are
  unchanged.
- Storefront filter drawer: one group per field, Yes/No labels, chips name the field.
- DB tests are in `catalog/browse.test.ts` ("extra field filters"); the pure ones are in
  `browse-metafields.test.ts`.

## Liquid `collection.filters` and `search`

- `theme-import/liquid-filters.ts`: Shopify filter and filter_value objects (`label`,
  `param_name`, `type` list/boolean/price_range, `values` with `count`, `active`,
  `url_to_add`, `url_to_remove`, `active_values`, `true_value` / `false_value`, price
  `min_value` / `max_value` / `range_max` in paise).
- A collection's own page: `collection.products`, `products_count`, `sort_by` and `filters`
  follow the request's `filter.*`, `sort_by` and `page` params through `LiquidDataSource.browse`
  (`browseProducts`). They load only when the theme reads them (`cache.listing`).
  `collections[x]` elsewhere stays unfiltered.
- Search page: `search` is a `SearchDrop` (`terms`, `performed`, `results`, `results_count`,
  `filters`, `sort_by`).
- The proxy forwards a canonical `x-listing` header (filter, q, sort_by and page params,
  sorted). It is in `DERIVED_HEADERS`, so a client cannot forge it. A collection or search
  page's Liquid render cache key includes it, so tracking params never split the cache.
- Tests: `theme-import/liquid-filters.test.ts`, `listingSearch` in
  `apps/storefront/src/lib/routing.test.ts`.
- `cachedLiquidData` now passes the recommendation `intent` through and keys its cache on it.
  Without this, complementary requests returned the related list.

## Shopify import: which fields become filters

Search & Discovery's filter list is not in the Admin API. Every Online Store theme writes the
store's filters into its collection page as `filter.p.m.<ns>.<key>` inputs, so the import
reads `https://<shop>.myshopify.com/collections/all` once, after product metafields, and marks
those fields with `markMetafieldsFilterable`. That only turns filterable on, and only for
filterable types. For Waimers that is filter_hand, filter_grip, filter_weight,
spec_switches and spec_connection. A store behind a password gives none, and the run logs
that. The merchant then ticks fields in Custom data. Tests: `test/storefront-filters.test.ts`.

## Blocks CSS scoped away from imported Liquid sections

`packages/blocks/src/styles` loads on every storefront page and shares the Zero Drift theme's
class names. Every rule that differs from the pre-restyle copy (`683ec339^`) is now written
`.x:not(:where(.shopify-section *))`. That covers the 17 Oct Figma restyle (card, price, badge,
headings, tabs, category panels, promo bento, library) and later changes to the ported files.
`:where` keeps each rule's specificity unchanged, so our own sections render exactly as before.
Inside an imported section, the theme's own stylesheet decides. The convention is noted at the
top of `index.css`. The #603 tab-label rules moved to the same form.

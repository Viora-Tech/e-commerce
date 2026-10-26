# 2026-10-26 Storefront search: predictive search works, better matching and ranking

The owner compared waimers.in (old Shopify site) with waimers.koomerce.app (imported Glide theme).

## What was wrong

- **Header predictive search never showed results.** The theme shim answered every
  `/search/suggest(.json)` call with an empty result, so the Glide drawer always said
  "No results for …". A direct `GET /search/suggest.json` was a 404.
- **Run-together words missed products.** "glasspad" found only titles with "glasspad"
  (31), not "Glass Mousepad" / "Glass Pad" products (Shopify: 73).
- **Multi-word searches were all-or-nothing.** "dysphoria aria" found 1 product; Shopify shows
  the other Dysphoria pads after it (11).
- **Ranking was alphabetical inside each relevance tier**, so "mousepad" listed every ATK pad
  first regardless of stock or age.
- The search form's `options[unavailable_products]` was ignored.
- Not a bug: the literal `No results for “__TERMS__”` in the HTML is the theme's
  `data-empty-text` template, filled in by its script; Shopify's page has the same string.

## What changed

- `apps/storefront/src/app/-s/[storeId]/search/suggest.json/route.ts` and `.../search/suggest/route.ts`
  (`lib/predictive-route.ts`, `lib/predictive-search.ts`, `lib/predictive-json.ts`): Shopify's
  Predictive Search on the store domain. JSON in Shopify's shape (products with `price`,
  `compare_at_price_*`, `image`, `featured_image`, `available`, numeric `id`; collections; the
  query), honouring `resources[type]`, `resources[limit]` (max 10) and
  `resources[options][unavailable_products]`. With `section_id`, the theme's section is rendered
  with `predictive_search` filled (Dawn-style themes). Rate limited like `/api/search/suggest`.
- `lib/liquid-shim.ts`: `/search/suggest` now passes through to those routes. Swap table and
  the theme-import developer doc updated.
- `packages/core/src/catalog/search-sql.ts` (split out of `browse.ts`): run-together words split
  into two catalogue words ("glasspad" → "glass pad", matched in the product's own fields, not the
  description); a multi-word search finding fewer than 5 products adds products matching some of
  the words, ranked after full matches; a finer tier for a title word starting with the query.
  `browse.ts`: equally relevant products rank buyable (in stock or pre-order) first, then newest.
  `unavailable` (`show` / `last` / `hide`) on `browseProducts` and `suggestProducts`; the search
  page and Liquid listing read `options[unavailable_products]` (`routing.ts` keeps it in the
  listing key).
- `search-words.ts`: the catalogue vocabulary now keeps 3-letter words ("pad") and is used for the
  typed plan too (splits only; typo correction still runs only when nothing matched).
- `packages/core/src/catalog/search-collections.ts`: `searchCollections` for the predictive
  collections column.

No migration: no pg_trgm/unaccent; typo tolerance stays the existing in-app edit-distance
correction against the catalogue vocabulary.

## Tests

`browse.test.ts` (split words, relaxed multi-word, buyable-first, `unavailable`, collection
search), `search-text.test.ts`, `predictive-json.test.ts`, `routing.test.ts`.

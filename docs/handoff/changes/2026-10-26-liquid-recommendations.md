# 2026-10-26 Imported themes: real product recommendations, blog publish time in IST

## What was wrong

- **"You may also like" was hidden on imported themes** (Glide on waimers.koomerce.app).
  `/recommendations/products` and `/recommendations/products.json` had no route on the store
  domain (404). The Liquid shim rerouted `fetch` calls for the HTML form to
  `/theme-actions/recommendations`, which needed a `section_id`, so the JSON form (and any call not
  made through `window.fetch`) got an empty answer and the theme hid the row.
- Complementary ("Pairs well with") had only the merchant's Search & Discovery picks; with none
  picked the row was empty.
- Related ranking stopped at collection / type / tags: a product with no close match showed nothing.
- Blog article "Publish date" (`components/blog/form-state.ts`) converted `datetime-local` values in
  the runtime zone (server UTC), shifting a scheduled time by 5:30 between server and browser.

## What changed

- `apps/storefront/src/app/-s/[storeId]/recommendations/products/route.ts` and
  `.../recommendations/products.json/route.ts` (`lib/recommendations-route.ts`,
  `lib/recommendations-json.ts`, `lib/recommended-products.ts`), following the `/search/suggest`
  pattern from #793:
  - `.json` (or no `section_id`) answers `{ intent, products }`, each product in Shopify's
    `product.js` shape (numeric `id` via `numericId`, `title`, `handle`, `url`, `vendor`, `type`,
    `price`/`price_min`/`price_max`, `compare_at_price*`, `available`, `featured_image`, `images`,
    `options`, `variants`, `media`).
  - Prices are **whole paise** (Shopify's subunit, `price: 89900` = ₹899.00). That is what Shopify
    sends from this endpoint and what `Shopify.formatMoney` expects. `/search/suggest.json` uses
    decimal rupee strings because Shopify's Predictive Search does.
  - `?section_id=` renders the theme's own section with `recommendations` filled (the existing
    `renderRecommendations`).
  - `limit` 1 to 10 (default 10), `intent=related|complementary`. The numeric `product_id` a theme saw
    maps back to our UUID (`resolveThemeProductId`). An unknown product returns 404, a missing
    `product_id` returns 422.
  - Rate limited per IP (60/min, `recommendations:ip`) like the suggest route. Cached
    `public, max-age=60`.
- `lib/liquid-shim.ts`: `/recommendations/products(.json)` now passes through to those routes. A
  failed answer still reads as an empty row (empty HTML, or `{ products: [] }` for JSON).
  `/theme-actions/recommendations` now delegates to the same handler, for pages still carrying
  the old shim.
- `packages/core/src/theme-import/related.ts`: ranking is the merchant's related picks, then shared
  collections, then the same product type **or vendor**, then shared tags, then **best sellers**
  (units on non-test, non-cancelled, non-draft orders, newest first on ties). The product itself,
  non-active products and sold-out ones (no stock and no pre-order) are always left out.
- `data.ts` `relatedProducts`: `intent=complementary` uses the merchant's complementary picks that
  are in stock. With none, it falls back to the related row.
- Swap table row and the theme-import developer doc updated.
- `apps/admin/src/components/blog/form-state.ts`: `toLocalInput` / new `fromLocalInput` use
  Asia/Kolkata via `@commerce/dates`, the same as the #805 discount fix. `toWrite` and the
  visibility card's "Published …" help text read the field as Indian wall time.

No migration.

## Tests

- `apps/storefront/src/lib/recommendations-json.test.ts`: params and product.js shape.
- `apps/storefront/src/lib/recommendations-route.test.ts`: JSON, section, 404/422, rate limit.
- `packages/core/src/theme-import/related.test.ts` (DB): vendor match, best-seller fill (test and
  cancelled orders ignored), complementary fallback that skips sold-out products.
- `forms-and-related.test.ts`: `rankRelated` vendor case.
- `apps/admin/src/components/blog/form-state.test.ts` passes under both TZ=UTC and TZ=Asia/Kolkata.

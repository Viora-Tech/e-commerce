# Judge.me import: store reviews, Shopify product ids, curation, missing-product list

Branch `feat/judgeme-reviews-import`. Migration **0137_review_store_reviews** (`review.product_id`
drops NOT NULL).

The Judge.me CSV import already existed (Apps → Reviews → **Import from Judge.me**,
`packages/plugin-reviews/src/judgeme.ts`, PR #281). This fills its gaps:

- **Store reviews.** A review with no product in the file (Judge.me's store reviews: empty
  `product_handle`, SKU and `product_id`) is now imported with `product_id = null` instead of
  skipped. It counts in `storeReviewTotals` and shows in `storeReviewFeed`, so an imported theme's
  `shop.metafields.judgeme.reviews_grid` / `all_reviews_rating` / `all_reviews_count` include it
  (`product_title` / `product_handle` blank, `product_url` `/`). Never on a product page or in
  `ratingSummaries`. Admin list says "Store review" in the Product column; the detail page shows a
  note card instead of the product card; the reply email links the home page.
  `listReviews`, `getReview`, `replyEmailData` and `storeReviewFeed` left-join `product` now.
- **Missing products.** The preview lists the handles the file names that this store lacks (25,
  most reviews first) and the merchant can tick "Import reviews with no matching product as store
  reviews" (`unmatchedAsStore`, default off). They keep their fingerprint, so a later re-import
  after bringing the product over skips them (they stay store reviews; delete and re-import to
  attach them).
- **Matching** is SKU → Shopify `product_id` (through `shopify_import_mapping`,
  `gid://shopify/Product/<id>`, read with raw SQL so the Reviews app does not depend on the
  Shopify importer package) → handle.
- **Curation.** `curated` = `spam` / `hidden` / `unpublished` → hidden; `not-yet` / `pending` →
  pending whatever the publish option; `ok` follows the option. (Was: only `spam` mapped.)
- **Headers** match case-insensitively with spaces or dashes; blank lines are ignored instead of
  counted as skipped. IP address and location are never read. External ids (fingerprints) are
  unchanged, so files imported before this change still dedupe.
- Pure helpers split out for tests: `matchRow`, `countJudgemeRows`, `rowsToImport`,
  `importedStatus`, `curationOf`. Unit tests in `packages/plugin-reviews/src/judgeme.test.ts`
  (13, pass without a database); DB cases added to `test/import.test.ts` (not run here).
- API: `reviews.judgeme.import` takes `unmatchedAsStore` (defaults to false); preview returns
  `store` and `unmatched`.
- Storefront `cardRatings` narrows the now-nullable `productId`.

Not done: Judge.me's `source` and `metaobject_handle` columns are ignored; videos in
`picture_urls` are skipped by the copy job like any non-image.

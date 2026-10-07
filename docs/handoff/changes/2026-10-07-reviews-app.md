# Reviews app to replace Judge.me (issue #281)

- Branch `feat/reviews-app`, migration **`0091_reviews`** (tables `review`, `review_media`,
  `review_request`, all under RLS via `apply_store_rls()`; SECURITY DEFINER
  `stores_with_due_review_requests()` for the worker; snapshot `0091_snapshot.json` and journal
  entry idx 86 added).
- **Plugin** `packages/plugin-reviews` (built-in, Apps → Reviews): `schema.ts`, `settings.ts`
  (pure, saved in `store.apps.settings.reviews`), `reviews.ts` (list, stats, detail, moderation,
  replies, `ratingSummaries` worked out on every read), `submit.ts` (storefront submit, verified
  buyer, per-email daily limit, one review per person and product), `requests.ts` (review request
  planning, sweep, email data, opt-out, "Ask for reviews"), `judgeme.ts` (CSV parse, SKU then
  handle match, idempotent import), `photos.ts` (`copy-photos` app job through
  `@commerce/core/safe-fetch`), `liquid.ts` (`reviewsLiquidSource`), `tokens.ts` (signed request,
  photo and stop links, purpose `review`).
- **Admin** (`apps/admin/src/components/apps/reviews/*`, copy `data/reviews.ts`, Hindi
  `data/hi/reviews.ts` for list and detail; import and settings marked untranslated): Reviews list
  (tiles, tabs, search, rating/product/photos filters, bulk approve/hide/delete, row menu), review
  detail (reply with AI suggestion when the product writer is on, activity, product, customer,
  show/feature switches, delete), Import from Judge.me (3 steps), Settings.
- **API** `packages/api/src/routers/reviews.ts` (`products.read`/`products.write`, install check),
  `services/ai/review-reply.ts` (runs under the `productWriter` feature and allowance; mock
  provider answers with a canned reply).
- **Storefront**: Glide Product reviews section draws the widget when
  `appBlockContext.reviews` is set (`lib/reviews.ts`); `/reviews/photo|submit|helpful`
  (`lib/review-actions.ts`, store from hostname, per-IP limits, honeypot `review_website`);
  `/reviews/unsubscribe` page. Product page: real rating under the title, `aggregateRating` and
  `review` in JSON-LD.
- **Core**: `AppEvent` gains `order.delivered` (fanned out from the outbox row); outbox types
  `review.request_due`, `review.replied`; templates `review_request`, `review_reminder`,
  `review_reply`; `deliverEmailTo` / `deliverToStoreContact` moved to
  `notifications/deliver-email.ts`; `saveImageForProcessing` (media); erasure scrubs reviews and
  deletes review requests; theme import: `withReviewMetafields`, `ShopMetafieldsDrop`
  (`shop.metafields.judgeme`), swap row `app_data` now `replaced`.
- **Worker**: `{reviews}-requests` repeat job every 10 minutes (`apps/worker/src/reviews.ts`);
  notifications consumer sends review emails and the reply email.
- Left out: Judge.me `@app` blocks (the theme's own `reviews.liquid` app-block region) still render
  nothing; stars on our own (non-Liquid) collection product cards; Hindi for the import and
  settings pages; the leak walk does not install apps, so reviews procedures are covered by
  `packages/api/test/reviews.test.ts` and the plugin's isolation test instead.

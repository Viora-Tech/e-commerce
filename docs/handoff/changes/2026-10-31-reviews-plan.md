# Reviews app: closing the gap with Judge.me (2026-10-31)

Follows the widgets step (`2026-10-30-reviews-widgets.md`). Migration **0197_reviews_plan**
(one for every step below): `review_request.phone` (and `email` nullable), `review.reward_code` /
`reward_sent_at`, tables `review_question` and `review_summary` (RLS), and the SECURITY DEFINER
`stores_with_stale_review_summaries()` for the worker.

## 1. Review requests by WhatsApp

- Setting `requestEmail.channel`: `email` (default, what older saved settings read as),
  `whatsapp` or `both` (`REQUEST_CHANNELS`, `requestContact` in `packages/plugin-reviews/src/settings.ts`).
  The delay is the existing **Send after delivery** days.
- `scheduleReviewRequests` plans a request when the order has an address for the chosen channel
  and keeps both the email and the phone on the row; `reviewRequestEmail` applies the channel again
  at send time and returns `contact`. The worker (`apps/worker/src/notifications.ts`) sends it with
  core's `deliverMessageTo`, so WhatsApp uses the store's channel and the approved
  `review_request` / `review_reminder` templates (`{{1}}` name, `{{2}}` store, `{{3}}` link,
  already in `notifications-whatsapp`). Opting out (stop link) now covers the email and the phone.
- Admin: Settings › "Send requests by" select (copy `data/review-tools.ts`, Hindi in `data/hi/review-tools.ts`).
- Tests: `packages/plugin-reviews/src/settings.test.ts`, WhatsApp case in `test/requests.test.ts`.

## 2. Request reviews from past orders

- "Ask for reviews" on the Reviews page now opens a dialog with a delivery date range (default
  the last 60 days), a live count of the orders that would be asked and how long sending takes.
- `packages/plugin-reviews/src/past-orders.ts`: delivered orders in the range (by `delivered_at`,
  else `placed_at`) reachable on the store's channel, with no review and no earlier request,
  newest first, at most `PAST_ORDERS_MAX` (2000) per run. Rate limit: requests are due
  `PAST_ORDERS_PER_HOUR` (200) orders an hour, starting after any requests an earlier run still
  has waiting. API `reviews.pastOrdersPreview` / `reviews.askPastOrders` (PRODUCTS_WRITE).
  The old `reviews.ask` (60 days, all at once) stays for compatibility; the admin no longer calls it.
- Tests: `packages/plugin-reviews/test/past-orders.test.ts`.

## 3. Review QR cards

- Admin page `/apps/reviews/qr/[target]` (`qr-page.tsx`, `review-qr-card.tsx`), target
  `product-<id>` (link "Review QR card" on a product's Reviews card) or `order-<id>` (new order
  action **Review QR card** on the order page's More actions, `admin.orderActions` in the plugin).
  Each card: the QR (the `qrcode` package the admin already uses for Growth links, MIT), a
  printable 1200x1500 PNG card drawn on a canvas (heading, product, code, store name), the SVG
  code and the link.
- Links (`packages/plugin-reviews/src/qr.ts`, API `reviews.qrLinks`): a product's card opens
  `/products/<handle>?write=1#reviews`, which now opens the form when the shopper may write
  (`openForm` in `apps/storefront/src/lib/reviews.ts`); an order's card carries one signed
  request link per product (60-day token), so the review is a verified buyer's.
- Tests: `src/qr.test.ts`, `test/qr.test.ts`.

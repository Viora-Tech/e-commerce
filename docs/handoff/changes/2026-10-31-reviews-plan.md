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

## 4. Photo review reward

- Setting `photoReward` (`enabled` off by default, `percent` 10, `days` 30); admin card
  "Reward photo reviews" (`reward-settings.tsx`) under the publishing settings.
- `rewardPhotoReviews` (`packages/plugin-reviews/src/rewards.ts`): published storefront reviews
  with a copied photo and an email, not rewarded yet, get a code from core's `issuePersonalCode`
  (the discounts table: single use, that customer only when known, ends after `days`), named
  `PHOTO-<last 8 of the review id>` so a retry finds the same code. Called from `submitReview`
  (published at once) and `reviews.setStatus` (approved later). Writes `review.reward_code` /
  `reward_sent_at` and a `review.rewarded` outbox row.
- New notification `review_reward` ("Photo review thanks", email; WhatsApp params
  `[store, "10% off", code]` if a store ever sends it there): types, content, samples, templates,
  `messages.ts`, admin Notifications copy (en + hi), relay and worker. `review_request` /
  `review_reminder` now list both channels in `messages.ts`.
- Tests: `packages/plugin-reviews/test/rewards.test.ts`.

## 5. AI review summary ("What customers say")

- Setting `aiSummary.enabled` (off by default; it spends the store's AI allowance under the
  product writer). Admin: card "What customers say (AI)" in Review settings, and the product's
  Reviews card shows the text, when it was written, the last error and **Refresh**
  (`product-summary.tsx`, API `reviews.summary` / `reviews.refreshSummary`).
- Table `review_summary` (0197): one row per reviewed product, `stale` set by
  `markSummariesStale` whenever reviews are published, hidden, moved, deleted, submitted live or
  imported (`reviews.ts`, `submit.ts`, `judgeme.ts`).
- Writer: `packages/ai/src/review-summary.ts` (instructions, up to 60 newest published reviews,
  guarded as data, clamp to 500 chars; mock answer in `mock.ts`). Worker
  `apps/worker/src/review-summaries.ts` (`{reviews}-summaries`, every 15 minutes, 20 per store per
  tick): stores from `stores_with_stale_review_summaries()`, admitted and metered through core's
  `admitAiCall` / `recordAiUsage`; fewer than 3 reviews clears it without a call; out of
  allowance or switched off saves the reason and stops for that store. The worker now depends
  on `@commerce/ai`.
- Storefront: `productReviews` adds `aiSummary` to the widget context (cached with the reviews);
  migration **0203_review_cache_triggers** puts the cache trigger on `review_summary` and
  `review_question` (`storefront-cache.ts` lists both). New product section `reviews/Summary`
  "What customers say (AI)" (`packages/blocks/src/sections/reviews-widgets/summary.tsx`,
  `components/reviews/widgets/review-ai-summary.tsx`), marked "Summarised by AI".
- Tests: `packages/ai/test/review-summary.test.ts`, `packages/plugin-reviews/test/summary.test.ts`.

## 6. Product questions (Q&A)

- Table `review_question` (0197, cache trigger 0203): question, asker name as shown (first name,
  last initial), private email, `pending | published | hidden`, answer. Service
  `packages/plugin-reviews/src/questions.ts`: `parseQuestionForm`, `askQuestion` (active products,
  5 per email a day), `listQuestions` (tabs: to answer, waiting, published, hidden; search),
  `answerQuestion` (save, or save and publish), `setQuestionStatus` (publishing skips unanswered),
  `deleteQuestions`, `publishedQuestions` (the 20 newest answers).
- Storefront: `POST /reviews/question` (`submitQuestionForm` in `lib/review-actions.ts`: per-IP rate
  limit, honeypot, store from the hostname); `productReviews` adds `questions` to the widget
  context. New product section `reviews/Questions` "Questions and answers"
  (`sections/reviews-widgets/questions.tsx`, client `components/reviews/widgets/product-questions.tsx`):
  answered questions with "Show all", and an "Ask a question" form.
- Admin: Apps › Reviews › **Questions** (`questions-page.tsx`, `question-card.tsx`; plugin page
  `questions`, a Questions button on the Reviews page), API `reviews.questions.*`.
- Tests: `packages/plugin-reviews/test/questions.test.ts`.

## Left out

- No email to the shopper when their question is answered (the form says the email stays private).
- No merchant alert for a new question; the Questions tab shows a "To answer" count.
- No Hindi for storefront copy (the blocks package has none), as before.
- Section preview pictures for the two new sections (`bun run section-previews`).

## Checks

Not run here (owner rule: one tsc + vitest pass on dev after merging).

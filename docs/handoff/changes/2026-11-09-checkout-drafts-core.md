# Checkout drafts, part 2: core

An online or UPI / bank transfer checkout is saved as a draft (`status = 'draft'`,
`draft_source = 'checkout'`, its own #D number) until its money arrives, when the store has
"unpaid checkouts as drafts" on (`checkoutDraftsOn`, still off by default). COD, and checkouts
gift cards or store credit help pay, stay orders at once.

- **Placing** (`order/place-order.ts`, `place-order-create.ts`): `enforceCheckoutRules` decides
  the `DraftPlan` (hold window from `draftHoldMinutes`). `createOrder` takes a draft number, keeps
  the stock `reserveStock` held as the draft's hold (`draft_reserved`, `reserved_until`), sets
  `last_activity_at`, writes no parcels and no `order.placed`. Discount uses are counted on the
  draft and given back when it expires. `PlaceOrderResult` has `draftNumber` and `resumedDraft`.
- **Same items again** (owner's rule, 9 Nov): same items (`itemsKey`) + same shopper (email OR
  phone) + an open checkout draft last active within `duplicateCheckoutHours` (24 h) =
  `findSameItemsDraft` (`order/checkout-draft.ts`). The checkout goes on that draft: the new step
  `prepareDraft` clears its hold, discount uses, lines and unanswered attempts
  (`clearDraftForRetry`), then `createOrder` writes the same row again at today's prices and
  method, bumps `last_activity_at` and notes "Shopper checked out again". No refusal, no second
  draft, no hourly cap. Different items make a new draft. Paying the same items by COD closes
  the open draft (`retireCheckoutDraft`, note `ORDERED_INSTEAD_NOTE`).
- **Repeat checks** (`order/duplicate-checkout.ts`) now see open checkout drafts (last activity,
  not placing time): with the switch off, a draft with the same items still refuses with
  "already placed (#D57), waiting for payment". `RecentCheckout.draftNumber` added.
- **Converting** (`convertCheckoutDraft`): inside `applyPaymentStatus`, under the order lock, a
  capture (or an authorisation: manual-capture stores, R1) on a checkout draft converts it in
  place in a savepoint: hold given back, stock routed and held again (`routeAndBillDraft`, now
  shared with `convertDraft` in `order/draft-place.ts`), parcels and GST billed, next order
  number, `placed_at` now. A duplicate webhook finds it converted. `OutOfStock` (hold lapsed,
  goods sold): the money is flagged refund-needed, the draft stays, `LATE_CAPTURE_NOTE` on its
  timeline. Transfers get `order.placed` at conversion; gateway checkouts get it from recompute.
- `convertDraft` on a checkout draft ("Convert to order (unpaid)") converts it the same way and
  keeps its pending attempt. `convertDraftForOnlinePayment` refuses checkout drafts.
- **Retries** (`retryPayment`, gateway fallback) work on open checkout drafts; an expired draft
  says `expired`. The gateway gets `draftNumber` instead of `orderNumber`; Razorpay's receipt is
  `draft-D57[-n]` and its notes carry `draft_id` and `draftNumber`.
- **Nudge and expiry**: the "payment not finished" nudge covers checkout drafts. The worker's
  unpaid tick also walks `stores_with_open_checkout_drafts()` (0233) and runs
  `expireCheckoutDrafts`: 7 days without activity sets `draft_expired_at`, gives back the hold
  and discount uses and cancels open attempts. Hard delete after 30 days is a follow-up.
- **Links**: `thankYouPath` / `payPath` print a draft as `D57`; `orderRefWhere` (view-access.ts)
  finds `2441`, `D57` or `-57`, also after the draft converted.
- **Drafts list** (`listDrafts`): `source` filter (`checkout` | `staff`), newest activity first,
  plus method, last attempt status/error, failed count, refund-needed, hold and expiry. Expired
  checkout drafts drop off the list unless money on them needs refunding.
- Tests: `order/checkout-draft.test.ts` (15), Razorpay receipt test, link tests.

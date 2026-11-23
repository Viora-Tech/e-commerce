# Coupons count when the payment succeeds, not at checkout

**What:** An online checkout that waits for payment (a checkout draft, #D) now only *notes* its
discount code; the use counts against the code's limits when the payment is captured and the
draft becomes an order. A failed, abandoned or expired payment no longer uses up the code.

- New column `discount_usage.counted` (migration `0266_discount_usage_counted`, additive, default
  true so existing rows stay counted).
- `recordDiscountUses(..., { noteOnly: true })` for checkout drafts (`place-order-create.ts`).
- `countDraftDiscountUses` in `convertCheckoutDraft` counts them on payment. The shopper already
  paid the discounted price, so a code past its limit or per-customer cap is kept and a timeline
  note says so (`OVER_LIMIT_NOTE`).
- `releaseOrderDiscountUses` (moved to `discounts/usage.ts`) only lowers `used_count` for counted
  rows. Per-customer counts, the discount's usage summary and the dashboard count read counted
  rows only.
- Cash on delivery and other orders placed at once still count at checkout, under the row lock.

**Why:** A shopper whose payment failed (23 Nov, Razorpay debit card EMI) and who then checked out
again with other items was told their one-per-customer code was already used, for up to 7 days.
Failed drafts also used up codes with a total limit.

**Trade-off:** two shoppers paying at the same moment for the last use of a limited code both
keep the discount (flagged with the note).

**Tests:** new `packages/core/src/order/checkout-draft-coupon.test.ts`; `place-order.test.ts`
per-customer concurrency test updated; core order/payments/discounts suites and api discount
tests pass.

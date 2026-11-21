# Commerce checklists and known gaps

These are our own rewrites of checklists in community Medusa skills (OrcaQubits
`medusa-cart-checkout`, `medusa-orders`, `medusa-payments`, `medusa-pricing`,
`medusa-fulfillment`, `medusa-security`, `medusa-testing`, `medusa-workflows`, `nextjs-patterns`,
`medusa-storefront`, all MIT; finsilabs `medusa-development`, MIT). Medusa API names are
dropped; each item points at our code. Paths are under `packages/core/src/` unless stated.

## Checkout and cart

- [ ] Checkout recomputes everything that costs money on the server: line prices
      (`order/place-order-load.ts` `loadCart`), discount (`resolveDiscount`), shipping
      (`resolveShipping`), payment adjustments (`paymentAdjustmentFor` in
      `order/place-order-rules.ts`). The client sends ids, never amounts.
- [ ] Shipping options are re-quoted after an address change; payment starts only after
      shipping is priced (the total includes it). Our single-page checkout does this in
      `apps/storefront/src/lib/cart-actions.ts` `checkoutAction`.
- [ ] Completion refuses a cart that is not open, empty, unpriced, hidden or not sold in the
      market (`loadCart`), and an address no zone covers (`ShippingUnavailable`).
- [ ] Cart ownership: the cart id is a random UUID in the httpOnly `wc_cart` cookie
      (`apps/storefront/src/lib/cart-cookie.ts`, `readCartId` refuses non-UUIDs). Signed-in
      checkout takes the customer from the session, not the form. Never accept a cart id from
      a form field or query string.
- [ ] Rate limit checkout by cart and by IP (`rateLimited` in `checkoutAction`).
- [ ] Never cache cart, checkout or customer data in Next (they read cookies, so stay dynamic).

## Payments

- [ ] Every create, capture and refund is safe to retry: an attempt key for creates
      (`attemptKey`), a `refundKey` for refunds, the event id for webhooks.
- [ ] Verify the webhook signature before storing or applying anything (`parseWebhook` in
      each `packages/payments-*` adapter).
- [ ] Out-of-order webhooks are harmless: `nextPaymentStatus` only moves forward.
- [ ] The captured amount must match what we asked for (`gatewayPaidTooLittle`).
- [ ] Session secrets and gateway keys never reach the client; only the checkout session the
      adapter returns (`sessionOf`) goes to the browser.
- [ ] A capture we cannot record is refunded (`startPaymentAttempt`, second catch).

## Refunds and returns

- [ ] Lock order, then payment, then re-read refunded so far (`refundPayment`). Keep this lock
      order anywhere else that touches both.
- [ ] Failed refunds do not count as money returned (`refundedPaise`, `paymentFacts` in
      `order/recompute.ts`).
- [ ] A return refund is capped by what the returned lines sold for after discount
      (`returns/store-credit-cap.test.ts`), and an RTO by what was paid and not refunded.
- [ ] Gift card money goes back to the same card; store credit back to the balance.
- [ ] Every return transition starts with `lockReturn` and checks the current status.

## Promotions

- [ ] Limits checked at resolve time are advisory; the claim under the row lock is the truth
      (`claimDiscountUse`).
- [ ] Combined discounts each count one use (`recordDiscountUses` loops `applied.parts`).
- [ ] A rolled-back checkout gives its uses back (`releaseDiscountUses`); a checkout draft
      that is retried gives them back too (`releaseOrderDiscountUses` in
      `order/checkout-draft.ts`).
- [ ] Test stacking: combined codes in `discounts/combo.test.ts`.

## Side effects and events

- [ ] Steps with side effects have a compensation; a side effect that cannot be undone (an
      email, a webhook to a third party) goes through the outbox (`outbox/write.ts`
      `insertOutboxEvent`) in the same transaction, so it only fires after commit.
- [ ] Outbox handlers re-read the entity instead of trusting the event payload (it may be
      stale by the time the worker runs).
- [ ] Keep core logic out of handlers: handlers notify and sync; the order path is in core.

## Test layers (what to add for a money change)

| Layer | When | Example |
| --- | --- | --- |
| Pure unit | A rule or derivation with no database | `order/aggregate-status.test.ts`, `discounts/evaluate.test.ts`, `shipping/rates.test.ts` |
| Property | A runner or state machine with many paths | `workflow/run.property.test.ts`, `payments/transitions.test.ts` |
| Database-backed service | Anything that locks, inserts or recomputes | `order/refund.test.ts`, `payments/attempts.test.ts` |
| Concurrency | A limit or "exactly once" promise | `Promise.all` of N calls on separate transactions, assert the count (`order/place-order.test.ts` limit-5 test) |
| Failure and compensation | A step after a side effect can fail | `order/place-order.test.ts` "refunds a captured payment when the database fails afterwards" |
| Cross-store | Any query by id | `payments/attempts.test.ts` "never applies an event to another store's payment" |
| Storefront | Preview and form rules | apps/storefront `src/lib/checkout-preview.test.ts`, `checkout-validation.test.ts` |
| Smoke | Before a release only | `bun run smoke:checkout -- --base <url>` |

Gateways are faked in tests (`payments/gateway-double.test-util.ts`); never call a real one.

## Known gaps found on 20 Nov 2026 (reported, not fixed)

1. **Fixed (#1789).** **Razorpay refunds ignore `refundKey`** (`packages/payments-razorpay/src/razorpay.ts`
   `refund`). `refundPayment` calls the gateway inside the transaction; if the commit fails
   after Razorpay refunded, the retry refunds again. Cashfree handles this (#1595).
2. **Fixed (#1790).** **Refund webhook fallback writes no refund row** (`refundProcessed` in
   `payments/webhook.ts`). A full refund made in the gateway dashboard flips the payment to
   `refunded`, but `derivePaymentStatus` counts refund rows, so the order still reads `paid`.
   A partial outside refund is dropped.
3. **Fixed (#1791).** **Compensating refund in `startPaymentAttempt`** has no `refundKey` and no catch: if that
   refund throws, `markFailed` is skipped and the attempt stays `created` with
   `gateway_requested_at` set, so nobody can claim it again.
4. **Cart prices are the add-to-cart snapshot**: `loadCart` charges `cart_line.unit_price_paise`
   for normal lines, not today's `variant.price_paise` (only campaign lines fall back). A price
   change or an ended sale does not reach a cart up to 30 days old.
5. **Per-customer discount caps need an email**: `customerUsageCount` returns 0 for a blank
   email, and email can be optional (Settings, Checkout), so phone-only shoppers skip the cap.
6. **Cancelled and expired orders keep their discount use**: no cancel path calls a release,
   so a shopper whose online payment expired cannot use a one-per-customer code again. This
   may be intended; ask the owner.
7. **Fixed (#1792).** **Webhook failure status is lost**: the `catch` in `handlePaymentWebhook` writes
   `status: 'failed'` inside the transaction it then rethrows from, so the row rolls back.
   The gateway retry still processes it; only the record of the failure is lost.

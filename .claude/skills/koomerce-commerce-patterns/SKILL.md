---
name: koomerce-commerce-patterns
description: The commerce patterns Koomerce took from Medusa (and Saleor) - checkout step order, payment idempotency keys, webhook dedupe, lock-then-recheck on refunds and discount limits, derived payment and fulfilment status, shipping options priced on the server, return requests - with where each lives, the rule to keep and the test that guards it. Use before changing any of placeOrder, payment attempts, webhooks, refunds, discount usage, order status, shipping rates or returns, and when reviewing such a change.
metadata:
  checked-against: "dev, 20 Nov 2026"
  sources: "Patterns from Medusa core (MIT) as credited in the code comments; checklists adapted from OrcaQubits/agentic-commerce-skills-plugins (MIT) and finsilabs/awesome-ecommerce-skills (MIT). See THIRD_PARTY_NOTICES.md."
---

# Commerce patterns (Medusa-derived)

Each pattern below is credited to Medusa in a code comment. The idea is Medusa's; the code and
the API are ours (no workflows SDK, no modules). Keep the rule when you change the file, and run
the guarding test. Longer checklists and the known gaps: [reference.md](reference.md).

Paths are under `packages/core/src/` unless they start with `packages/` or `apps/`.

## 1. Checkout steps: order first, payment last

- **Where**: `order/place-order.ts` (`placeOrder`, `placeOrderAndPay`), runner
  `workflow/run.ts` (`runWorkflow`).
- **Rule**: every step that writes has a `compensate`, undone in reverse. Price, discount,
  shipping and checkout rules are decided before `reserveStock`, so a refusal leaves nothing to
  undo. The gateway is never called inside the stock transaction; `startPaymentAttempt` runs
  after commit, and a gateway failure fails only the attempt.
- **One order per cart**: unique index `order_store_cart_unique` (`packages/db/src/schema.ts`).
- **Tests**: `order/place-order.test.ts` ("never calls the gateway inside the stock
  transaction", "keeps the order and its stock, and fails only the attempt...", "two concurrent
  submits of one cart create exactly one order", "the database refuses a second order for the
  same cart", "refunds a captured payment when the database fails afterwards");
  `workflow/run.test.ts`, `workflow/run.property.test.ts`.

## 2. Payment attempts with idempotency keys

- **Where**: `payments/attempts.ts` (`attemptKey` = `orderId:attempt`, `createPaymentAttempt`,
  `startPaymentAttempt`, `retryPayment`); the provider contract `packages/payments/src/types.ts`
  (`idempotencyKey` on `CreatePaymentInput`, `refundKey` on refunds).
- **Rule**: one `payment` row per try, each with its own key (unique index
  `payment_store_idempotency_key`). Only one caller may ask the gateway for an attempt: the
  claim is a conditional update on `status = 'created' and gateway_requested_at is null`.
  Adapters send the key as the gateway's idempotency header where one exists, otherwise in the
  receipt or notes so webhooks can find the attempt (`findPaymentId` in `payments/confirm.ts`).
- **Tests**: `payments/attempts.test.ts` ("sends the attempt key to the gateway...", "retry
  makes a new attempt on the same order; a double tap makes one", "finds the attempt by its key
  when the gateway reference was never recorded").

## 3. Webhooks: verify, store once, apply forward-only

- **Where**: `payments/webhook.ts` (`handlePaymentWebhook`), `payments/confirm.ts`
  (`applyPaymentStatus`), `payments/transitions.ts` (`nextPaymentStatus`).
- **Rule**: verify the signature before storing anything. Store the event under the unique
  `payment_event_provider_event` index, then lock it; a processed duplicate is acknowledged and
  not applied. Status only moves forward (a late failure never undoes a capture). The reported
  amount must cover the attempt (`gatewayPaidTooLittle`). A capture on a cancelled or already
  paid order is kept but flagged `refund_needed`, never a second capture (index
  `payment_one_capture_per_order`).
- **Tests**: `payments/webhook.test.ts`, `payments/attempts.test.ts` ("two concurrent
  deliveries of one event apply it once", "a capture after the order was cancelled is flagged
  refund needed", "the database allows one gateway capture per order"),
  `payments/amount-check.test.ts`, `payments/transitions.test.ts`.

## 4. Lock-then-recheck on refunds

- **Where**: `order/refund.ts` (`refundPayment`, `refundedPaise`).
- **Rule**: lock the order row, then the payment row (the same order as `applyPaymentStatus`,
  so no deadlock), then re-read what is already refunded under the lock and refuse more than
  is left. The gateway refund carries a deterministic `refundKey`.
- **Tests**: `order/refund.test.ts` ("two parallel refunds cannot return more than the
  capture", "refuses more than what is left").

## 5. Discount usage limits under concurrency (`registerUsage`)

- **Where**: `discounts/usage.ts` (`claimDiscountUse`, `recordDiscountUses`,
  `releaseDiscountUses`); called from `order/place-order-create.ts` and `order/drafts.ts`.
- **Rule**: `resolveDiscount` checks limits from a snapshot; the real claim locks the discount
  row `FOR UPDATE`, re-counts the shopper's uses under the lock, and increments `used_count`
  only while it is under `usage_limit`. A rolled-back order gives its uses back.
- **Tests**: `order/place-order.test.ts` ("8 parallel checkouts on a code with limit 5 redeem
  it exactly 5 times", "a per-customer cap of 1 holds across parallel checkouts by the same
  shopper"), `order/draft-discount.test.ts`.

## 6. Derived order statuses (`aggregate-status`)

- **Where**: `order/aggregate-status.ts` (pure: `derivePaymentStatus`,
  `deriveFulfillmentStatus`, `deriveLifecycle`), `order/recompute.ts`
  (`recomputeOrderStatuses`, the one writer).
- **Rule**: payment status comes from payment rows plus their refund rows (failed refunds do
  not count); a flagged capture not yet returned reads `refund_needed`. Never set
  `payment_status` or `fulfillment_status` by hand; every mutation path calls
  `recomputeOrderStatuses` in its own transaction, after its writes.
- **Tests**: `order/aggregate-status.test.ts`, `order/recompute.test.ts` ("a gateway capture
  pays the order once...", "refunds move the payment status...", "fixes a drifted row").

## 7. Shipping options priced on the server

- **Where**: `shipping/rates.ts` (`quoteShipping`, `ratesForZone`, `pickZone`), schema
  `shippingRate` in `packages/db/src/shipping-schema.ts`, the `resolveShipping` step in
  `order/place-order.ts` (via `quoteProfileLines`, `shipping/profiles-service.ts`).
- **Rule**: the client sends only a rate id; the server re-quotes from the address, lines and
  discounted subtotal and refuses an id that is not on offer (`ShippingRateUnavailable`).
  Delivery options re-run their engine (`koomerce-delivery-options`).
- **Tests**: `shipping/rates.test.ts`, `shipping/rates-service.test.ts`,
  apps/storefront `src/lib/checkout-preview.test.ts`.

## 8. Return requests separate from refunds

- **Where**: schema `returnRequest`, `returnRequestLine` in `packages/db/src/returns-schema.ts`;
  `returns/service.ts` (`requestReturn`, `lockReturn`, `receiveReturn`, `restockReturn`);
  `returns/resolve.ts` (`refundablePayments`, `refundReturn`, `storeCreditReturn`).
- **Rule**: a return has its own lines and status; money goes back only through
  `refundPayment` or store credit, so pattern 4 and 6 apply. Lock the return before every
  transition; a unit cannot be in two live returns; restock moves only what is not restocked.
- **Tests**: `returns/returns.test.ts`, `returns/returns-flow.test.ts` ("keeps its units: the
  same item can not be returned twice"), `returns/store-credit-cap.test.ts`.

## Before you merge a change to any of these

Run the guarding tests above (database-backed: `docker compose up -d --wait`, then
`cd packages/core && bunx vitest run <files>`). See `koomerce-testing` for the layer to add.

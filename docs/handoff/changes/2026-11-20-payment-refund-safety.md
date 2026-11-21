# Payment and refund safety: four gaps from the Medusa patterns review (20 Nov 2026)

Branch `fix/payment-refund-safety` (from `dev`). Issues #1789, #1790, #1791, #1792. No migration.
Gaps 1, 2, 3 and 7 in `.claude/skills/koomerce-commerce-patterns/reference.md`.

## Changes

- **Razorpay refunds are idempotent (#1789).** `packages/payments-razorpay/src/refunds.ts`
  `refundOnce`: with `context.refundKey`, the key goes out as the refund `receipt` and
  `notes.refund_key`. The payment's refunds (`fetchMultipleRefund`) are looked up by that key
  before creating one, and again when the create call throws (a lost reply). A refund found with
  the key but for another amount is refused. Razorpay has no refund idempotency header, so this
  lookup does the dedupe. Without a key it behaves as before.
- **Gateway-dashboard refunds become refund rows (#1790).** `packages/core/src/payments/refund-webhook.ts`
  (moved out of `webhook.ts`): a `refund.processed` with no row of ours is recorded as a
  `processed` refund (reason "Refunded on the payment gateway", deduped by the gateway refund id
  under the order and then the payment lock), capped at what is left on the payment. The
  payment status is synced (`syncRefundedStatus`, now exported), the order recomputed, and a
  system note added to the timeline. Part refunds made outside Koomerce now count, and a whole
  one makes the order read refunded.
- **Compensating refund in `startPaymentAttempt` (#1791).** `payments/attempt-refund.ts`
  `refundTaken`: stable key `rfc_<first 20 hex of the attempt id>`. It never throws. A failure is
  logged (`[payments] compensating refund failed; refund by hand` with the attempt, reference and
  amount) and added to the attempt's `error`. The attempt is always marked failed.
- **Webhook failure mark survives (#1792).** `handlePaymentWebhook` processes the event in a
  savepoint (`processEvent`). On an error only that work rolls back, the event is stored
  `failed` with the error, and the call returns `{ ok: false, retry: true }` without throwing.
  The worker (`apps/worker/src/payments.ts`) commits, logs, and answers **500**, so the gateway
  still retries. The retry finds the event `failed` (not `processed`) and processes it in full.

## Tests

- `packages/payments-razorpay/test/refund.test.ts` (mocked client)
- `packages/core/src/payments/refund-status.test.ts` (dashboard part and whole refunds, note)
- `packages/core/src/payments/attempts-compensate.test.ts`
- `packages/core/src/payments/webhook.test.ts` (a JS error, then a DB error, then the retry)
- `apps/worker/src/payments-retry.test.ts` (commit, then 500)

## Left open

- `refundPayment`'s key is `rf_<payment>_<already refunded>`. If the gateway's webhook records
  the refund before a failed commit is retried, `already` has changed, so the retry's key is new
  and a second refund can be made. Fixing that needs a key the caller supplies per request
  (Medusa-style idempotency key on the refund action).
- An attempt whose compensating refund failed has no admin flag yet (`refund_needed` only
  counts captured payments). Today the server log and the attempt's error are the only record.
- `gateway-health.test.ts` and `apps/worker/src/webhook-reply.test.ts` do not load in this
  worktree because of the stale `@commerce/payments-snapmint` module. This existed before this
  branch.

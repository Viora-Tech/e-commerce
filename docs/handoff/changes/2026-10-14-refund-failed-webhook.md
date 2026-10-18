# Refunds the gateway later fails no longer count as refunded

**Bug (found in the pre-launch audit, money):**
- A refund is stored as `pending` when the gateway accepts it.
- `refund.processed` set the payment to `refunded` but never updated the refund row. It stayed `pending`.
- A refund the gateway later failed was ignored: Razorpay `refund.failed`, and Cashfree `REFUND_STATUS_WEBHOOK`
  with `CANCELLED`/`FAILED`. Order recompute counts every refund that is not `failed`, so the order (and its
  return) said the money went back when it hadn't, and nobody was told.

**Fix:**
- `@commerce/payments` has a new webhook event, `refund.failed`.
  - Razorpay parses `refund.failed` and registers it on OAuth connect (`RAZORPAY_WEBHOOK_EVENTS`).
  - Cashfree maps refund status `CANCELLED`/`FAILED` to it.
- `core/payments/webhook.ts` `settleRefund`: sets the refund row (by `provider_refund_id`) to `processed` or `failed`,
  then recomputes the order. A failed refund stops counting, so the order's payment status shows the money as
  still with the store.
- The Razorpay setup copy, English and Hindi, plus the merchant docs now say to tick `refund.failed` too.

**Merchants who connected Razorpay by hand** must add `refund.failed` to their webhook. OAuth-connected stores get it
on the next connect.

**Follow-up:** show failed refunds in the activity bell (`feat/activity-bell`) once both are merged.

Test written: Cashfree `CANCELLED` refund parses to `refund.failed`. It runs on dev after merge.

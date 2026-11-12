# "Partly refunded" for every gateway; daily Decentro refund status sync (12 Nov 2026)

Owner's answers to the apps group 3 audit (`docs/audits/2026-11-12-apps-group-3.md`).
Migration **0241** (`0241_pending_gateway_refunds`).

- **The rule.** A payment reads "Refunded" only when every paisa captured went back (refunds
  that did not fail); some of it is "Partly refunded". Razorpay, Cashfree and Decentro alike.
- **How (no new status value).** The payment row's `refunded` now means fully refunded only;
  a part refund leaves it `captured`, and "Partly refunded" is worked out from the refund rows,
  as the order level already did (`derivePaymentStatus` → `partially_refunded`). Chosen over a
  new row status because every reader of the money (order status, reports, analytics, MCP,
  emails) already works from refund amounts; a new enum value would have meant a schema change
  and touching each `captured`/`refunded` check.
  - `packages/core/src/payments/refund-settle.ts` (new): `settleRefunds` sets refund rows to
    processed or failed, then `syncRefundedStatus` moves the payment `captured` ↔ `refunded` by
    amount (a failed refund puts a fully refunded payment back to `captured`), then recomputes
    the order. Order rows are locked first.
  - `payments/webhook.ts`: `refund.processed` no longer sets the payment `refunded` outright.
    Ours: the row settles as above. Not ours (made on the gateway's dashboard): only a refund of
    the whole payment marks it refunded, as before.
  - Admin payment pill (`order-detail-types.ts` `paymentStatus`): from amounts, so rows an
    earlier part-refund webhook set to `refunded` read "Partly refunded" without a data fix.
  - Shopper side: new `ShopperPaymentState` `partly_refunded` ("Partly refunded") on the
    account order pages and the chat order card; it used to say "Refunded".
  - Copy: admin "Partially refunded" is now "Partly refunded" (orders, order page, analytics);
    Hindi "कुछ रिफ़ंड हुआ" (analytics aligned to it).
- **Decentro refund sync.** `PaymentProvider.fetchRefundStatus` (optional, new) is implemented
  by Decentro (Get Transaction Status by the refund's id, then our reference id). Core
  `syncPendingRefunds` (`payments/refund-sync.ts`) asks about refunds pending 1 hour to 60 days,
  oldest first, outside transactions, and settles each through `settleRefunds`. Worker sweep
  `refund-sync` (`apps/worker/src/refund-sync.ts`), daily, critical priority in the memory guard;
  stores found by SECURITY DEFINER `stores_with_pending_gateway_refunds()` (0241). A failed
  refund shows on the order timeline in red and stops counting as money returned.
- Decentro UPI payout refunds: still not in the UI (owner).
- Tests: `packages/core/src/payments/refund-status.test.ts` (per gateway: Razorpay and Cashfree
  webhooks, Decentro sync), `packages/core/src/accounts/shopper-payment.test.ts`,
  `apps/admin/src/components/orders/payment-status-pill.test.ts`,
  `packages/payments-decentro/test/refund-status.test.ts` (faked HTTP).

# Refund safety tests replace the manual Razorpay check

The open manual test "Refund safety (Razorpay test mode)" is now automated in
`packages/core/src/order/refund-safety.test.ts` (database-backed, Razorpay faked by a
`RazorpayDouble` that dedupes by refund key like `payments-razorpay/src/refunds.ts`). No real
keys, no network.

Covered:

- Partial refunds add up to the capture and not one paisa more; hand-recorded and store credit
  refunds count against the same capture; order-level `refundOrderAmount` is capped across all
  payments.
- Repeats: three parallel full refunds of one payment give one refund and one gateway refund;
  two parallel order-level refunds on a split order cannot both go through; a retry after the
  transaction failed sends the same `refundKey`, so Razorpay refunds once; a declined gateway
  refund records nothing.
- Store credit vs original: store credit raises the balance and never calls Razorpay; original
  calls Razorpay and gives no credit.
- Store credit + UPI order: a full original refund sends ₹600 to Razorpay and ₹400 back as
  credit; a partial refund takes the UPI money first; all to store credit makes no gateway call;
  the store credit payment always goes back as credit even if UPI is asked for.
- Pending, authorized, failed and cancelled payments are refused; a failed-payment order has
  nothing refundable; a store credit hold released on cancel cannot be refunded a second time.

Already covered elsewhere and left alone: `order/refund.test.ts` (two parallel partials),
`payments-razorpay/test/refund.test.ts` (receipt and notes lookup).

No bug found in the refund code. Known limit, not changed: a partial refund sent twice on purpose
(two separate requests for ₹300) is two refunds; the cap still holds and the dialog disables its
button while a refund is running. A per-request key from the dialog would need a new column.

Run: `cd packages/core && TEST_DB_NAMESPACE=refundsafe bunx vitest run src/order/refund-safety.test.ts`.

# Collect payment works on a partly paid order

**What:** `collectOrderPayment` (`packages/api/src/services/order-fulfil.service.ts`): when the
order already has a capture, the amount recorded by hand is saved as a second capture
(`multi_capture = true`) instead of tripping the one-capture-per-order index.

**Why:** Owner, 23 Nov: Collect payment on #2398 (imported from Shopify, ₹25,000 of ₹26,999
paid) answered "Internal server error" three times. Live logs: `duplicate key value violates
unique constraint` (23505) on the payment insert: `payment_one_capture_per_order` allows one
non-split capture per order unless `multi_capture` is set.

**Tests:** new `packages/api/test/orders-collect-partly-paid.test.ts`; with
`orders-contact-payments.test.ts` 13/13. API typecheck clean.

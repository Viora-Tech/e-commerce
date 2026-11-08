# Store credit at checkout, step 2 of 5

A signed-in shopper can spend their store credit balance (step 1, #1286) at checkout. Issue #1303.

Open-source radar: same as step 1, built in-house on our own tables (it has to sit inside our
order, payment and RLS rules); nothing copied, so no `THIRD_PARTY_NOTICES.md` entry.

## Behaviour (decisions)

- **On by default.** A signed-in shopper with a balance sees "You have ₹X in store credit" in the
  summary's codes area, with a switch that starts on. It is their own money, so using it is the
  likely wish, and the switch keeps it for later. Guests never see it (`storeCreditOffered`, and
  `checkoutAction` only ever passes the session's customer).
- **Amount**: min(balance, what is due now after discounts, payment fee, shipping and gift cards).
  A deposit pre-order's later balance is not paid from it. The summary shows "Store credit −₹Y"
  under the total, then "To pay". Never on a basket of gift cards (it would turn credit into a
  code).
- **Full cover**: no gateway, `order.payment_method = store_credit`, payment row `captured`, order
  paid. The Payment step says "Paid by store credit".
- **Part cover**: the rest goes through the picked online way to pay. **Cash on delivery is not
  offered for the rest** (same rule as gift cards): a COD parcel that is refused would leave the
  credit tied up. The server refuses it too (`StoreCreditError`, shown on the form).
- **Debit safely** (`packages/core/src/customers/store-credit-checkout.ts`): the balance is
  debited when the order is placed, under the account's `FOR UPDATE` row lock (two checkouts
  queue; the second sees what is left, and `balance_paise >= 0` backs it). With a gateway the
  store credit payment row is `pending` (a hold, not the order's money yet). It is captured in
  the same transaction as the gateway capture (`applyPaymentStatus` → `captureHeldStoreCredit`;
  "Mark as paid" too). A failed payment keeps the hold (the shopper can retry); when the order is
  cancelled unpaid (the 30-minute expiry, the unpaid-transfer cancel, staff) `cancelOrder` →
  `releaseHeldStoreCredit` cancels the hold and puts the money back with a new ledger kind
  `release` ("Order #N was not paid: store credit returned"). A captured store credit payment on
  a cancelled order goes back as a refund, the way gift card money does.
- **Order records**: the payment row (`provider = store_credit`, `providerPaymentId` = customer
  id) shows as "Store credit" in the admin's Transactions card; ledger lines link to their order
  on the customer's Store credit card. A refund of that payment always goes back onto the
  balance (`refundPayment`); the refund dialog says so and offers no other way.
- **GST**: store credit is a payment. It runs after `createOrder`, so total, taxable value and
  GST never move (tested). GST invoices name it under payment ("Store credit"; also added "Gift
  card").
- **Account page**: `/account/store-credit` (nav "Store credit"), read-only: balance and the
  newest 20 changes in the shopper's words with the order number (`shopperStoreCredit`; never
  the staff reason, which the admin dialog promises the customer does not see).

## Code

- Migration `0229_store_credit_checkout.sql`: ledger kind `release`; `payment_one_capture_per_order`
  now leaves out `store_credit` as well as `gift_card` (split tender).
- `payments/split-tender.ts`: `STORE_CREDIT_PROVIDER`, `SPLIT_TENDER_PROVIDERS`, `isSplitTender`.
  Everything that skipped gift card rows as "not a gateway attempt" now skips both: attempts,
  retries, expiry, transfer follow-up, cart replay, the one-capture check in `confirm.ts`,
  `markPaid`, pre-order forfeits, refund routes (split tender last), storefront pay/thank-you/
  chat lookups, offline-method sets, profit fees.
- `placeOrder`: input `storeCredit: { customerId }`, state `storeCreditPaise`, step
  `spendStoreCredit` after `redeemGiftCards`; `paidByCards` counts both.
- Storefront: `StoreCreditField` in the summary, `checkoutTotals` (`storeCreditPaise` in,
  `storeCreditUsedPaise` out), thank-you summary and Payment cell lines.
- Tests: `customers/store-credit-checkout.test.ts` (partial and full cover, three concurrent
  checkouts, failed payment then expiry restores, staff cancel restores, guest and someone
  else's order, COD refused, GST unchanged, refund back to balance) and store credit cases in
  `checkout-preview.test.ts`.

Not checked in a browser: the checkout and account pages were not opened (no `next dev` here).
Next steps: Shopify store credit import; moving customer gift cards into balances; order #2424.

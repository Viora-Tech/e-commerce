# Saturday 21 Nov: live tests for store credit and UPI AutoPay

Branch `feat/draft-store-credit` (not merged, not deployed). What changed on it is listed under
"Code changes" below. The checklist is written for the live store as it is **today** (without these
fixes); the "Not live yet" notes say what will act differently until the branch is released.

## Before you start

- Store credit belongs to a customer record. Sign in on the storefront with the same email or
  phone as that customer (Account → Store credit shows the balance). A guest never sees credit.
- **Cash on delivery is not offered for what store credit leaves.** This is the agreed rule
  (same as gift cards): with ₹200 credit on a ₹600 order, checkout moves you to an online way to
  pay and COD is greyed out ("Not available with store credit for part of the order"). So:
  - Test A (COD): add credit that covers the whole order, item plus shipping. Then nothing is
    collected on delivery and the order reads "Paid by store credit".
  - Test B (₹200 part payment): pay the rest online with UPI. This is real money, refunded when
    you cancel.
- Pick the cheapest item so little credit is needed.

## Test 1: store credit

1. Admin → Customers → your customer → Store credit card → **Add credit**. Amount (₹200 for
   Test B, or the order total or more for Test A). Reason "Saturday test". No expiry.
   - Check: Balance shows the amount; History has one "Adjusted" line by you.
2. Storefront, signed in: add the item, go to checkout.
   - Check: the summary says "You have ₹X in store credit" with the switch on; under the total
     "Store credit −₹Y", then "To pay".
   - Test A: To pay is ₹0 and the Payment step says "Paid by store credit". **Not live yet:**
     do not pick Cash on delivery before the credit applies. Today a covered COD pick still adds
     any COD fee or COD courier price and, with the COD & RTO app's confirmation on, sends a
     "confirm your COD order" message. Leave UPI picked (it is first by default).
   - Test B: COD is greyed out; pay the rest with UPI.
3. Place the order.
   - Admin → Orders → the order. Check: Payment status Paid (A) or Paid once UPI captures (B).
     The Transactions card shows a "Store credit" row for the credit amount (captured), plus the
     UPI row for B. Payment method "Store credit" (A).
   - Customer → Store credit: balance lower by the credit used; History "Paid an order" linked
     to the order number.
4. Cancel: order page → **Cancel order**. Reason "Other", restock on, notify off. Refund
   "Original payment" (B also refunds the UPI part to the gateway).
   - Check: order Cancelled; Transactions show the store credit refunded.
   - Customer → Store credit: balance back to the amount from step 1, **exactly once**; History
     has one "Refund" line for the order (A or B paid). An order cancelled before its UPI part
     was paid shows "Returned (order not paid)" instead.
5. Repeat-cancel check: reload the order page. Cancel order is gone, and Refund has nothing
   left on the store credit row. The balance does not move again.

Undo: Customer → Store credit → **Remove credit** for the full balance (reason "Saturday test
undo"), so the balance is ₹0. The cancelled order stays (orders are never deleted); cancelled
orders do not count in sales. For B, check the UPI refund in the Razorpay dashboard.

## Test 2: UPI AutoPay (plan subscription)

Before: the live admin needs `PLATFORM_RAZORPAY_KEY_ID`, `PLATFORM_RAZORPAY_KEY_SECRET` and
`PLATFORM_RAZORPAY_WEBHOOK_SECRET`, and the Razorpay dashboard needs a webhook to
`<admin>/api/billing/autopay-webhook` with that secret and the events subscription.authenticated,
activated, charged, halted, cancelled, completed, paused and resumed. Without the keys, Plan &
billing says "UPI AutoPay is coming soon" and there is no button. A store marked unlimited is
never billed, so test on a store with a paid plan. The charge is real money: the plan price plus
18% GST (Starter monthly ₹589).

1. Admin → Settings → Plan & billing → Next bill → **Turn on UPI AutoPay**.
   - Check: you land on Razorpay's approve page. Back in admin: "Approve the AutoPay mandate in
     your UPI app to finish turning it on", with **Approve mandate** and **Turn off AutoPay**.
2. Approve the mandate in your UPI app. Razorpay takes the first charge.
   - Check (within a minute, after webhooks): Plan & billing reads "UPI AutoPay is on"; a new
     plan bill is Paid; the GST invoice email arrives. In the platform sales store's admin, the
     bill's order is Paid with the Razorpay payment id. Razorpay dashboard → Subscriptions:
     Active.
   - **Not live yet:** today the paid period starts at the charge time, so days left on the
     current period are lost. On the branch it starts where the paid time ends.
3. Failure path (optional, cannot be forced live): if Razorpay gives up retrying a charge, the
   owner gets "UPI AutoPay stopped" by email and Plan & billing shows it halted with **Turn on
   UPI AutoPay** again. Renewals go back to pay links. Covered by tests.

Undo: Plan & billing → **Turn off AutoPay**. Check: "AutoPay is off. Renewals come with a pay
link again."; Razorpay dashboard shows the subscription Cancelled. Refund the first charge from
the Razorpay dashboard if you want the money back, then cancel that bill's order in the sales
store so it no longer counts as paid. **Not live yet:** today a second **Turn on** after an
unapproved one leaves the old Razorpay subscription open (its link could still charge); cancel
any stray "Created" subscriptions in the Razorpay dashboard.

## Code changes on the branch (for the release)

- Store credit (`c2711069c`): a COD pick that credit or gift cards cover is a prepaid order. No
  COD confirmation, no COD fee or route (`place-order.ts` recordPaymentAttempt,
  `checkout-preview.ts` checkoutTotals). Tests `customers/store-credit-cod.test.ts`.
- AutoPay (`aaa092013`): one bill per Razorpay payment, even with webhook copies at once or
  replays; the period starts at the end of paid time; no second subscription while one is
  active; replaced subscriptions are cancelled at Razorpay; a cancelled mandate never comes back
  on. Tests `billing/autopay.test.ts` (mocked Razorpay, dummy test keys).
- There is no "AutoPay is on" email. The owner gets the GST invoice email for each charge and
  "UPI AutoPay stopped" on a halt. AutoPay keeps charging the plan it started on; a plan change
  needs Turn off then Turn on (not changed here).

# Founding merchant offer: first 20 sign-ups get 30 days free, then Growth ₹999/month for 12 months

Branch `feat/founding-offer` (from `origin/dev`). Migration `0272_founding_offer` (additive).

## What changed

- Owner's offer B (27 Nov 2026): the first 20 stores to sign up while the offer is open get a
  30-day trial, then monthly Growth at ₹999 (not ₹1,999) + 18% GST for 12 paid full monthly
  bills, then the normal price. Rule and constants: `packages/core/src/billing/founding-offer.ts`
  (`FOUNDING_OFFER`, `foundingApplies`, `foundingMonthsLeft`, `foundingDiscountPaise`). Set
  `FOUNDING_OFFER.open = false` to stop new places; places already taken keep their price.
- Sign-up: `createStore` (`packages/core/src/onboarding/service.ts`) now calls
  `startSignupPlan` (`founding-offer-service.ts`), which takes a place under
  `pg_advisory_xact_lock(hashtext('founding_offer'))` and counts places across stores with the
  SECURITY DEFINER function `founding_offer_taken()`. Stores made before this (Waimers and
  every existing store) get no place. `ensureStorePlan` is unchanged (14 days) for stores whose
  row is made elsewhere.
- Columns: `store_plan.founding_offer_at` (when the place was taken, never cleared) and
  `plan_payment.founding_offer` (the bill was at the founding price). Months = paid,
  non-prorated founding bills (`loadFoundingState`). Cancelled and prorated bills do not count.
- Bills: `createPlanBill` (`service.ts`) bills a founding month as the Growth line at its
  normal GST-inclusive price (₹2,358.82) less a ₹1,180.00 discount labelled "Founding offer"
  (draft `discountLabel`, so the GST invoice shows it), total ₹1,178.82; the order note says
  "Founding offer: Growth at ₹999 a month, month N of 12". A prorated bill carries the founding
  price in its quote.
- Quotes: `quotePlanChange` takes optional `prices` (`target`, `current`);
  `loadPlanChangeQuote` passes the founding price for the target and for crediting unused
  founding days on an upgrade.
- UPI AutoPay (`startAutopay`): a founding store's Razorpay plan is created at ₹1,178.82 and the
  subscription's `total_count` is the founding months left. When Razorpay completes it, the
  existing `subscription.completed` handling turns the mandate off and renewals go back to pay
  links at the normal price. No Razorpay dashboard step: plans are created through the API.
- Admin: `PlanView.founding` (`loadPlanView`); Current plan card shows the "Founding offer"
  chip, ₹999 with ₹1,999 struck through and months left; Change plan / Compare plans show it on
  the monthly Growth card; Next bill (`projectNextBill`, new `founding` field) prices the
  renewal. Copy `billingContent.founding` with Hindi in `data/hi/billing.ts`.
- `siteConfig.contact.whatsappNumber` is now `919355074123` (the Waimers support number, the
  same as `contact.phone` and the Waimers theme's product-page WhatsApp), not the placeholder.
- Merchant guide: `settings/plan-and-billing.mdx` gains "Founding merchants".

## Tests

- `packages/core/src/billing/founding-offer.test.ts` (pure: who gets it, cap, months, renewal,
  discount, quotes, next bill) and `founding-offer-service.test.ts` (database: 21 sign-ups at
  once give exactly 20 places, closed offer, the bill's order and discount, 12-month count and
  normal-price renewal, AutoPay amount and `total_count`). `next-bill.test.ts` expects the new
  `founding: false`.

## Left to do / for the owner to check

- Sign-up is open by default (`MERCHANT_SIGNUP_MODE` defaults to `open` in
  `packages/config/src/env.ts`); only `MERCHANT_SIGNUP_MODE=invite` in the admin app's Dokploy
  environment closes it.
- Test sign-ups on live also take places. To give one back:
  `update store_plan set founding_offer_at = null where store_id = '<id>';`
- The www pricing page does not mention the offer yet.

# Checkout drafts, part 3: storefront

What the shopper sees when their unpaid checkout is a draft (`docs/design/unpaid-checkouts-as-drafts.md`).

- Thank-you and pay pages (`app/-s/[storeId]/checkout/thank-you/[number]`, `pay/[number]`) find
  the order with `orderRefWhere`: `/checkout/thank-you/D57` opens the draft, and keeps opening it
  after it became order #2441. Links are built by `thankYouPath` / `payPath`, which print a draft
  as `D57`.
- The page shows `#D57` (`orderRef`) and offers "Retry payment" / "Pay now" / "Pay online
  instead" on an open checkout draft as on an open order. No Purchase pixel, A/B purchase or
  discovery conversion for a draft (nothing was bought yet), and no "Track your order".
- Same items again on the shopper's open draft (`resumedDraft`): the checkout goes straight to
  paying that draft, and the pay or thank-you page (`?again=1`) says "You already placed this
  order (#D57) and it is waiting for payment. Please pay for it to confirm it."
- With the switch off, the existing repeat prompt (`lib/checkout-repeat.ts`) names a draft
  `#D57` and its "Pay for this order" link opens that draft.

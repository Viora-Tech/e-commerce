# Checkout: the delivery card's fact line (Figma 942:513, 942:769, 945:519)

Each delivery card now has a third line under the arrival date, built from what the quote
already knows (`apps/storefront/src/lib/delivery-card-line.ts`, tests beside it):

- **How it travels**: "By air" (service name has Air or Apex), "Express" (express speed),
  "Surface" (otherwise). Left out when the title already says it ("Blue Dart Air") and on
  zone-rate cards that have no courier route.
- **Cut-off countdown**: "Order in the next 2 h 14 min" on the card that arrives first, in the
  last 6 hours before today's dispatch cut-off (Settings → Shipping cut-off, time zone and
  working days, the same calendar the dates use). `CheckoutShipping.dispatchCutoffAt` carries
  the instant; the card ticks every 30 s and drops the countdown once it passes.
- **Paying**: "Pay online for this option" on a prepaid-only option (replaces the old
  `delivery-card-note.ts`), or "Cash on delivery available" when the option takes COD. Both
  only when COD is a way to pay at this checkout.

At most three facts, joined with " · ", in the existing muted 0.75rem note style.

The order summary's delivery row reads "Shipping · insured" while the parcel is insured
(Figma 945:519); the price already includes insurance.

Not shown (no data yet): "Tracking on WhatsApp and SMS" (nothing says which channels send
tracking updates); per-courier COD on courier-list cards (the route summary has no
`codAvailable`, so the option's COD is used).

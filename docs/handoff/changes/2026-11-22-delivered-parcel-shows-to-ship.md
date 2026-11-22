# Partly shipped card: a parcel sent without a label showed "To ship" with no items

Live, Waimers #2082 (imported from Shopify, taken over 21 Nov): the keyboard was marked fulfilled
on Shopify (no shipment row came over); today the wrist rest got a RapidShyp label. The order
page showed "Partly shipped · 1 of 2 parcels", "Parcel 1 — To ship" with no items, and
"Parcel 2 — Label created".

**Cause.** Booking the wrist rest ran `separateShippedUnits` (`order/parcel-split.ts`, added for
#2073): the sent keyboard stays in parcel 1, now `fulfilled` (1 of 1 packed), and the wrist rest
moves to parcel 2, which the label carries. The data is right (both parcels `fulfilled`, both
order lines packed, order `fulfilled`). The Partly shipped card only knew two states: a live
label, else "To ship" listing the unpacked lines. Parcel 1 has no live label (only a cancelled
Delhivery one from 21 Nov), so it read To ship and listed nothing, and the chip counted only
parcels with a label.

**Fix.**
- `orderPartShipping` (`packages/core/src/order/parcel-progress.ts`) gives each parcel
  `packed`: no live label and every unit packed (`parcelPacked`: status `fulfilled`, or every
  line packed).
- `partly-shipped-card.tsx`: such a parcel shows a neutral **Fulfilled** chip, all its items,
  and "Shipped without a label here (marked as shipped, or before the order came over)"; no
  Create shipment. The chip counts it as shipped, so #2082 now reads 2 of 2 and the chip goes.
- Copy in `data/order-cards.ts` + Hindi overlay.

No data fix needed: the live rows are correct and render correctly with this change.

Test: `packages/core/src/order/fulfillment-orders.test.ts` › "orderPartShipping after the sent
units were separated (#2082)" (ran, passes with the file's 27 tests). No jsdom test for the card.

# Bulk ship drawer, courier drawer polish, insurance default, shopper's choice (12 Nov 2026)

Branch `feat/bulk-ship-drawer`.

## Bulk ship drawer (Figma 908:8804) replaces the 3-step bulk dialog

- Several ticked orders (Shipments › To book "Book selected", Orders bulk "Ship", courier app
  actions) now open `create-shipment/bulk-ship-drawer.tsx`: one full-width bottom drawer, one
  table. `create-shipment-dialog.tsx` keeps the one-order dialog and renders the drawer for two
  or more orders. Removed: `bulk-shipment-flow.tsx`, `bulk-package-step.tsx`,
  `bulk-courier-step.tsx`, `bulk-done-step.tsx`.
- Columns: Order (+ customer), Ship to (city PIN), Package (box, charged weight, "Ships 1 of 2
  items" when the parcel is part of the order), Payment (Prepaid/COD chip + value), Courier
  (logo, label, "Recommended · Change" / "via Shiprocket · Change" / "Shopper's pick · Change",
  plus "Shopper chose Express · ₹99" when the pick is not the shopper's), Delivery, Charge,
  Ready chip or a fix button, edit pencil.
- Courier rule chips: Recommended · Cheapest · Fastest · One courier for all (with a courier
  select). Shipping insurance switch top right. Footer: Ready N of M, Need attention, Total incl.
  GST (+ insurance), Wallets (warns when a wallet is short for the batch), Cancel, Book N labels.
- Problem rows stay in the table, unticked: Needs weight (and box) → Add weight; No courier takes
  COD here → Ask to pay online; no courier / one courier can't take it / shopper's route can't
  book → Change courier. Every fix opens the Edit popup on that order.
- Pure logic in `bulk-ship-state.ts` (rules, problems, totals, book request, pickup groups),
  data in `use-bulk-ship.ts`. Tests: `bulk-ship-state.test.ts`.

## Edit popup (Figma 913:9698), reused and aligned

`bulk-edit-dialog.tsx` now edits one order fully: items in the parcel, box, weight and L × W × H
with the charged-weight note (`bulk-edit-package.tsx`); courier select with the shopper's
checkout choice, Cheapest/Fastest hint, Prepaid / COD switch, "Insurance for this order",
charge (`bulk-edit-shipping.tsx`); Skip this order, Save, Save and next. A changed package or
payment asks that order's couriers again. Form logic in `bulk-edit-state.ts`.

## Bulk result (Figma 909:9249)

`bulk-result.tsx`: Done chip, "N labels booked", Print card (Print N labels opens each courier
label, Packing slips opens the packing-slip print view), Skipped card with a fix link to each
order's Create shipment page, and `bulk-pickups-card.tsx`: one row per courier with parcels and
weight, "Pickup already booked · time · ID" when the courier has one open (the parcels join it),
"New pickup request" otherwise, a day/time select (today, tomorrow, the day after; today only
offers times still ahead), Later / Create pickups (pickup + manifest).
`pickup-fields.tsx` exports `upcomingPickups` for this.

## Back end

- `shipments.bulkBook` takes `perOrder` (orderId → weightGrams, dimensionsCm, paymentMode,
  insured) so the Edit popup's changes book; `bookingFor` merges them with the batch values.
  `bookSavedRoute` passes a payment mode through. The pure helpers (`bookingFor`,
  `deliveryChoiceOf`) live in `packages/api/src/services/shipment-choices.ts`.
- `shipments.prepare` returns per order `unitsOrdered` and `deliveryChoice` (from
  `order.shipping`: option or zone rate name, price, saved route), per parcel `boxName`, and
  `insureByDefault`.
- Settings › Shipping: "Shipping insurance on by default" (`policy.insureByDefault`, default
  on) in the store's shipping JSON; no migration. The single drawer, bulk drawer and Edit popup
  start from it (or from the shopper having paid for insurance); each order can still switch.

## Single order (Figma 898:7790, 898:7376)

- Courier drawer: the picked row's breakdown is one line (`price-breakdown-strip.tsx`): Freight
  (charged kg) · COD fee · Insurance · GST 18% · You pay; the weight working and insurance rate
  are in tooltips. Roomier rows, outline badges, shared `courier-mark.tsx` logo tile. The
  shopper's route row says "Shopper's pick".
- Summary card: Pickup (joins an open pickup of that courier, else "Later, on Booked"), Freight,
  Insurance, GST 18% rows (`summaryParts`).
- Route card: "Shopper chose: Express · ₹99 (Delhivery Express)" or "No delivery option chosen".

## Left out

- Rating and pickup-day columns (no data). Label format select in the Print card: no courier
  label-size setting or merged label file exists; labels open in the courier's own size.
- "Ask to pay online" does not send a payment link (none exists for COD orders); it opens the
  Edit popup, which says to ask the shopper and then switch the order to Prepaid.
- The popup shows the parcel's items read-only; splitting a parcel stays on the one-order page.

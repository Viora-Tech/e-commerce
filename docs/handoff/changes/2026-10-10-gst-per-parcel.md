# GST per parcel

**Branch** `feat/gst-per-parcel`, stacked on `feat/multi-location-routing` (#368, rebased on dev). **Migration
`0099_gst_per_parcel`**: `fulfillment_order` gains its share of the order's money
(`subtotal_paise`, `discount_paise`, `adjustment_paise`, `shipping_paise`, `total_paise`) and its
GST (`tax_paise`, `tax_breakdown`, `tax_origin`); backfill copies the order's figures onto orders
with one parcel. PR 3 of the split-across-warehouses plan.

- **Maths** (`packages/core/src/tax/parcel-gst.ts`, PARCEL_ALLOCATION header, pure):
  `computeParcelGst` shares discount, payment fee/discount and shipping over parcels by goods
  value (largest remainder, adds back exactly), then `computeOrderGst` per parcel from its own
  GSTIN state; composition GSTIN parcels charge 0%. `mergeOrderGst` sums them for the order
  (`interState` only when every parcel is IGST). One parcel = identical to before.
- **placeOrder** stores each parcel's money + tax + origin on its fulfilment order, the merged
  breakdown on the order, and bills the order from the parcel holding the most value. Gift-card
  only orders (no parcels) compute as before.
- **Displays**: a split order can carry CGST + SGST and IGST together; admin order totals,
  storefront order page and order emails use `gstRowsToShow` (`@commerce/core/gst`).
- **Known gaps**: `order_line.gst_rate_percent` still records the normal rate on a composition
  parcel's line (the parcel's breakdown is the truth); drafts get parcels without money (drafts
  have no GST split yet, PR 6). Invoices still issue per order until PR 4: don't enable a second
  selling location before PR 4 merges.
- **Tests (written, not run)**: `tax/parcel-gst.test.ts`, more cases in
  `order/routing-service.test.ts`, `db/test/gst-per-parcel-backfill.test.ts`.

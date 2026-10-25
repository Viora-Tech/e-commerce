# Create shipment: one flow for every Ship button, with a courier choice (2026-10-13)

Owner report: clicking Ship (order page, Shipments) went straight into one courier, with no way
to pick Delhivery, Shiprocket or RapidShyp. Branch `feat/create-shipment-flow`.

Why it happened:

- The order page's **Create shipment** called `orders.createShipment({ orderId })`, and
  `bookShipment` booked with `primaryShippingProvider` (the first enabled courier). No choice.
- The next-step card's **Compare couriers** only linked to Orders → Shipments.
- **Book by order number** skipped the comparison whenever one courier answered, and pickups
  were always asked of the first courier, even for parcels another courier holds.

What changed:

- **One dialog**, `components/shipments/create-shipment/create-shipment-dialog.tsx`
  (`CreateShipmentDialog orderIds onClose onBooked`). One order: `single-shipment-flow.tsx`,
  Package → Courier → Review → Booked. Several: `bulk-shipment-flow.tsx`, Package → Courier →
  Booked. Entry points: order page (next-step card **Create shipment** and the Shipment card),
  Shipments **Ship now** per To book row, **Book selected** / bulk bar, and **⋯ → Book by order
  number** (now only resolves numbers, then hands the ids to the dialog). `book-dialog.tsx` and
  `courier-compare-table.tsx` are deleted. `entry-points.test.ts` fails if any other admin file
  calls `orders.createShipment`, `shipments.bulkBook` or `shipments.quote`.
- **Step 1 Package** (`shipments.prepare`, read-only): each order's open parcels (fulfilment
  orders) with their unpacked items, value, weight (products, else main box) and own box; pickup
  places (locations with courier pickup on, plus Settings › Shipping's address); payment mode and
  COD amount. Orders older than parcels ship whole (`id: null`).
- **Step 2 Courier** (`shipments.quote`, replaces `shipments.compareRates`): every connected
  courier per parcel from the picked pickup place. `compareCourierRates` now asks rate and
  serviceability together and gives each row `problem` (`not_serviceable`, `no_cod`,
  `unreachable`) with `problemDetail`; badges and Recommended only go to rows without a problem
  (COD-aware). `datedCourierRows` adds `deliveryBy` from the dispatch calendar (store's usual
  transit days when the courier gives none, `etaFromSettings`). No rate API → "Rate on booking".
  **Ship it yourself** books through `orders.fulfil` with the AWB and courier name.
- **Booking** `orders.createShipment` now takes `providerId`, `fulfillmentOrderId`,
  `pickupLocationId` (null = store address), weight, dimensions, `paymentMode`, `codAmountPaise`.
  `createShipmentForOrder` books one parcel: its unpacked units only, from its location, packed
  with the new `fulfilParcelLines` (`packFulfillmentOrderLines(..., onlyParcel)`). A parcel that
  is the whole order is declared at the order total, one of several at its share. Without the
  new options it behaves as before.
- **Bulk**: one courier for all (totals per courier), or cheapest / fastest per order, sent to
  `shipments.bulkBook` as `courierOverrides`. Orders that ship in several parcels are left out of
  a batch (booked from the order page).
- **Pickups**: `schedulePickupForStore` groups shipments by courier and pickup name (the
  parcel's location, else the warehouse name) and asks each courier for its own. It returns an
  array of pickup rows now.
- Copy `data/create-shipment.ts` + Hindi `data/hi/create-shipment.ts`; next-step copy updated in
  both. Merchant guide `orders/shipments.mdx` and developer docs `building/plugins.mdx`
  (`quoteRate`) describe the flow.

Tests: `packages/core/src/shipping/courier-rates.test.ts` (problems, COD-aware recommended,
dates), `apps/admin/.../create-shipment/flow-state.test.ts` (step 1 form, starting pick, bulk
totals and picks), `entry-points.test.ts` (wiring). The parcel booking path
(`fulfilParcelLines`, `createShipmentForOrder` with a parcel) has no DB test yet; the existing
DB suites were not run on this branch (no database copies).

Not done: a per-parcel courier choice inside a bulk batch; the manual "Ship it yourself" path
packs the parcel's items with `orders.fulfil`, which takes units from the first parcel that
holds them (same as Fulfil items).

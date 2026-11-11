# Each parcel keeps its courier, insurance per parcel, pre-order room fixed (#1570, #1538, #1539)

Branch `fix/multi-parcel-and-preorder`, PR into `dev`. Follow-up to the split-cart checkout (#1546,
PR #1549). No migration: the per-parcel routes live in the order's `shipping` JSON.

## Multi-location checkout (#1570, owner's decisions 12 Nov 2026)

- **Each parcel's courier is saved.** `OrderDeliveryRoute.parcels` (new, optional, in
  `packages/db/src/schema.ts`; the type is in `delivery-schema.ts`, as `schema.ts` is at its
  file-size cap): one `OrderDeliveryParcelRoute` per parcel (`locationId`, `onHold`
  for a pre-order parcel, route, insured, insurance, markup, courier cost, promised dates). The
  order's own fields stay the first parcel's, so older readers are unchanged. Absent for a
  one-location order and for an option on backup (no route saved, as before).
  - `resolveParcelDeliveries` now also returns `parcels` (each parcel's own engine result).
  - `orderDeliveryFor(..., parcelKeys?)` (`delivery-options/checkout.ts`) picks each parcel's
    route for the shopper's choice (`chosenRoute`: sub-choice, COD or pick) and saves them.
    `priceOrderDelivery` passes the snapshot parcels' `locationId:status` keys.
  - Booking: `deliveryForParcel(delivery, { locationId, status })` (`delivery-options/booking.ts`)
    swaps in the parcel's own route (same location, pre-order parcel to the pre-order route
    first, else the first at that location; unknown location: the order's route).
    `bookingContext(tx, storeId, orderId, fulfillmentOrderId?)` uses it (Create shipment passes
    the parcel), and `createShipmentForOrder` uses it for a named parcel (on-route insurance,
    carrier, off-route note). Booking the whole order still uses the order's route.
- **Free stays free; paid stays paid.** Unchanged: the Shipping rate is charged once per order.
  New test: free India shipping with two parcels charges ₹0 (live and on backup).
- **Insurance per parcel.** In `parcels.ts` `addUp`, a parcel priced from the Shipping rate now
  counts the rate once (highest rate part) plus every such parcel's insurance; with insurance
  the total is rounded up to ₹10 like one parcel's. Free (₹0) parcels add nothing.

## Pre-order room (#1538)

The cart counted pre-order room on stock summed over every location, while `reserveStock` holds
a pre-order line past stock whole at the home location and counts the limit there. The cart now
counts the same: `lineAvailable` = the larger of free stock everywhere (ships from stock) and
home free stock + what is left of the limit at home. Home is `homeSellingStock`
(`packages/db/src/stock.ts`, the `primarySellingLevel` row: default location when it sells
online, else first selling location by priority). Routing's home can differ only when the
default location does not sell online (routing then takes its most preferred location).

## Pre-order full message (#1539)

`reserveRoute` throws `PreorderLimitReached` when the limit refuses a pre-order. It now extends
`OutOfStock` (code `PREORDER_LIMIT_REACHED`), so every existing `instanceof OutOfStock` handler
(late capture refund note, draft conversion, invoice payment) behaves as before. Storefront
checkout shows `checkoutErrorsContent.preorderFull` ("Pre-orders for this item are full, …").
The storefront has no Hindi overlay, so there is no Hindi copy.

## Verify

Browser check owed (no dev server on the owner's PC): a cart split across two locations, placed
and booked parcel by parcel in Create shipment, should mark each parcel's own courier "Chosen at
checkout"; a pre-order over its limit should show the "Pre-orders for this item are full" message.

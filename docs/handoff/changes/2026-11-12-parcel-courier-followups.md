# Parcel couriers: bulk booking, order page, deterministic match (follow-ups to #1578)

Branch `feat/parcel-courier-followups`, PR into `dev`. Follow-ups to #1578 (merged; its note is
`2026-11-12-multi-parcel-and-preorder.md`). No migration: everything lives in the order's
`shipping` JSON.

## Each saved parcel route knows its parcel

- `OrderDeliveryParcelRoute.fulfillmentOrderId` (new, optional, `packages/db/src/delivery-schema.ts`).
  Placing the order (`place-order-create.ts`) and converting a checkout draft (`draft-place.ts`)
  stamp it right after `createFulfillmentOrders`, via `saveParcelIds` / `withParcelIds`
  (`delivery-options/booking.ts`): same location, pre-order route to the `on_hold` parcel, each
  used once. Only split carts write (one extra `update order` at placement).
- `deliveryForParcel(delivery, { id, locationId, status })` now matches by that id first, then
  the old rule (location, pre-order flag, first at the location). So a pre-order parcel released
  later (status `open`) at a location that also has an in-stock parcel keeps its own route.
  Orders saved by #1578 before this stamp use the old rule.
- `createShipmentForOrder` also matches when no parcel is named but the order has one live parcel
  left (`soleFulfillmentOrder`), and passes the parcel id.

## Bulk booking books each parcel on its own route

- `bulkBookShipments` (`shipments-workspace.service.ts`) books parcel by parcel:
  `parcelsToBook` (`delivery-booking.service.ts`) gives the parcel the merchant quoted
  (`parcelIds`, new optional `shipments.bulkBook` input: orderId → fulfilment order id), else,
  for an order with saved `delivery.parcels`, every parcel still to ship (open or pre-order, not
  held, no live label), else the whole order as before. Each parcel books through
  `bookingContext(..., parcelId)` + `bookSavedRoute(..., { fulfillmentOrderId })`, or the
  merchant's courier override with `fulfillmentOrderId`. Results carry `fulfillmentOrderId`.
- Single-location orders: unchanged route; the admin bulk flow now sends the parcel it quoted
  (`bulkOrders(picks, quotes)` in `flow-state.ts`), as the one-order flow already did, so the
  booking carries that parcel's units. The single-courier shortcut is skipped when `parcelIds`
  is sent. The admin bulk flow still skips orders with several open parcels (booked from the
  order's own page); an API caller booking such an order now gets one shipment per parcel.

## Order page lists each parcel's courier

`DeliveryRouteCard` now takes `order` (from `order-side-column.tsx`) and renders nothing without
a saved delivery route. With `delivery.parcels` it shows the option, then
`DeliveryParcelRoutes` (new sibling): one line per parcel, "Parcel 2 · from Mumbai", courier and
service, then pre-order / insured / promised. Copy in `data/order-cards.ts` and the Hindi overlay.

**Shipping margin adds up every parcel (owner, 12 Nov 2026).** `shippingMargin`
(`delivery-options/margin.ts`, browser-safe) takes a fourth argument, `parcelCharges`
(fulfilment order id → booking charge). With `delivery.parcels`, margin = what the shopper paid
for delivery − every parcel's courier cost (its own booking's charge, else its checkout quote) −
every insured parcel's insurance. It stays unknown until every parcel's cost is known, and the
courier line says `mixed` ("booked parcels, the rest as quoted at checkout") when some parcels are
booked. Without parcel routes it is the order-level figures, as before. `orders.get` now returns
`parcelCourierCharges` next to `parcels` (`orderParcelsWithCharges` in `booking.ts`: one extra
query, only for split carts). Bulk screen one row per parcel: later (owner).

## Tests

`booking.test.ts` (id match after release, stamping), `flow-state.test.ts` (`parcelIds`),
`packages/api/test/bulk-book-parcels.test.ts` (DB: two locations book their own couriers; a
released pre-order at the same location keeps its own; a quoted parcel books alone). Demo courier
only, no real courier calls.

## Verify

Browser check owed: place a cart split across two locations, open the order (one line per parcel
on the Delivery option card), then bulk Create shipment from the orders list for an order with
one parcel left: it should book that parcel on its own courier.

# One box, several orders: "Same box as #A", and no more silent shipment moves

Incident, 15 Nov 2026: Waimers packed #2462 and #2464 (one customer) in one box under one
Delhivery AWB. Packing #2464 with #2462's AWB hit the shipment upsert on (provider, waybill),
which moved #2462's shipment to #2464: #2462 stayed fulfilled with no live shipment, so it never
got tracking or closed as delivered. Branch `fix/shared-parcel-orders`.

## 1. A tracking number on another order is refused (first commit)

- `packages/core/src/order/waybill-owner.ts`: `assertWaybillFree` throws
  `TrackingNumberOnAnotherOrder` (order number, and whether that shipment is still live).
  Called by `fulfilOrderLines` (pack card, Ship it yourself, and bulk Mark as fulfilled through
  `fulfilAllLines`) and by `createShipmentForOrder` when the merchant typed the number (India
  Post). The upsert now only updates this order's own row (`setWhere`); the same order
  re-packing under its own AWB keeps one row, and a row closed by "Mark as not shipped" becomes
  `created` again.
- Edit tracking (`shipping/tracking-edit.ts`) names the order that already has the number.
- API: `fulfilRpcError` (services/order-fulfil.service.ts) returns CONFLICT with
  `data.reason = 'awb_on_another_order'`; the admin's `lib/awb-clash.ts` reads it. The pack card
  and the bulk dialog show the message in English or Hindi (the bulk dialog used to count every
  BAD_REQUEST as "skipped").
- `applyTracking` moved to `shipping/apply-tracking.ts` (re-exported from `shipments.ts`) to keep
  `shipments.ts` under the 500-line cap.

## 2. "Same box as #A"

- Migration `0249_shipment_shared_order.sql`: table `shipment_shared_order` (shipment, extra
  order, its parcel), RLS through `apply_store_rls()`. The shipment stays on the order it was
  booked for; each row is another order riding in that box. The RTO task index
  `return_request_rto_shipment` widens to (shipment_id, order_id), so a shared box that comes back
  opens one task per order. (The name `shipment_order` was taken by an index on `shipment`.)
- Core: `shipping/shared-parcel.ts` (choices, join, leave, release) and
  `shipping/carries-order.ts` (`carriesOrder(orderId)`: own shipments or a shared box). Readers
  switched to it: `recomputeOrderStatuses` (so the order goes shipped, delivered, returned with the
  box), the shipped message's AWB (`notifications/deliver.ts`), the shopper's order page
  (`accounts/orders.ts`), the order page's shipment panel and the Orders list Delivery chip.
- `applyTracking` recomputes and writes `shipment.out_for_delivery` / `order.delivered` for every
  order in the box, and `recordRtoForShipment` runs once per order (its own units).
- Joining: `fulfilOrderLines({ sameBoxAs: shipmentId })` packs the lines and links the box
  instead of writing a shipment. Allowed only into a live (created, picked up, in transit, out for
  delivery) shipment booked for another open order of the same customer (customer record, else
  email). Both timelines get a note.
- Leaving: "Mark as not shipped" on the riding order takes it out; "Mark as not shipped" or
  Cancel shipment on the booked order releases every rider (items back to To ship and in stock,
  with a note).
- API: `orders.sameBoxChoices({ orderId })` (in routers/order-undo.ts); `orders.fulfil` takes
  `sameBoxAs`; `orders.get`'s `shipment` gains `sameBoxAs` and `alsoCarries`
  (services/order-shipment.service.ts, moved out of shipping.service.ts).
- Admin: Fulfil items has a "Parcel" select (`components/orders/same-box-field.tsx`, shown only
  when the customer has such a box) that hides the tracking fields. The shipment card shows
  "In the same box as order #A" (link) read-only on the rider, and "Also carries #B" on the booked
  order. Copy in `data/shared-parcel.ts` + `data/hi/shared-parcel.ts`.

## Not done / owner decisions

- The riding order's shopper gets their own shipped, out-for-delivery and delivered messages
  (one per order). Merge them into one if that is too many.
- Shipments list rows and counts are per shipment, so the box is one row; the extra orders are not
  listed on that row yet. RTO summary counts tasks, so a returned shared box counts as two RTOs.
- The Create shipment drawer's "Ship it yourself" has no "Same box" option; it is on the order
  page's Fulfil items card only.
- #2464 itself needs fixing by hand in the live data: move the shipment back to #2462 and link
  #2464 with "Same box as #2462" (or re-pack it).

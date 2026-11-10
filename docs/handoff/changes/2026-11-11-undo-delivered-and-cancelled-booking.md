# Cancelled booking back to To ship; Mark as not delivered (#1467, #1468)

- `deriveFulfillmentStatus` (core order/aggregate-status.ts): when every shipment on the order is
  cancelled (and it was not hand-delivered), the order is `unfulfilled` (To ship) instead of
  `fulfilled`. Packed with no booking at all stays `fulfilled`. Rebooking works as before.
- `undoDelivered` (core order/undo-delivered.ts) + `orders.markNotDelivered` (api routers/order-undo.ts):
  clears `order.delivered_at`; parcels whose status is delivered only by hand (tracking never said
  delivered) go back to their tracked status; adds a timeline note; recomputes. Courier-reported
  deliveries are untouched. Order page › More actions › "Mark as not delivered" on delivered orders.
- The shopper's Delivered message already sent cannot be recalled.
- Tests: aggregate-status.test.ts, recompute.test.ts (both undo cases, cancel → To ship).

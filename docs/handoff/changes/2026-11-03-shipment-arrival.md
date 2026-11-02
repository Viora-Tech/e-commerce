# Inbound shipments follow their purchase orders (#1062, #1065)

Receiving a purchase order never touched its inbound shipment, so imports stayed "On the way"
with the goods already on the shelf, and there was no way to mark a shipment delivered.

- **Receiving → shipment (#1062):** `receivePurchaseOrder` calls `syncShipmentArrival`
  (core `inventory/shipment-arrival.ts`): when every live (not cancelled) order on the shipment
  is received or closed, the shipment becomes `delivered` and `arrivedAt` is set if empty.
- **Shipment → receiving (#1065):** **Mark as delivered** on the shipment page and in the list's
  row menu. `inboundShipments.outstanding` shows units still to come per order;
  `inboundShipments.receive` (`receiveInboundShipment`) receives all of them as accepted at each
  order's location, then marks the shipment delivered. Short or damaged deliveries are received
  on the order first (rejected units); this takes in the rest.
- `DeleteRowMenu` takes `before` items for actions above Delete. Copy in `data/purchasing.ts`
  + Hindi; merchant guide Stock → Inbound shipments. MCP action docs regenerated.
- Tests: core `purchasing.test.ts` "shipment arrival" (auto-deliver on the last receipt incl. a
  refused unit; mark delivered after a partial receipt, stock and outstanding checked).

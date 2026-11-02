# Inbound shipments bulk actions (#1045, #1055)

- The inbound shipments list is now selectable, with a selection bar
  (`components/inbound-shipments/shipment-bulk-actions.tsx`): **Mark as delivered** (runs
  `inboundShipments.receive` per shipment, same as the shipment page), **Change status** (On the
  way / At the port / Customs cleared) and **Delete** (empty shipments only; the server refuses
  the rest and they count as failed in the toast).
- New core `setInboundShipmentStatus` + API `inboundShipments.setStatus`: changes only the stage,
  keeps every other field, never moves a delivered shipment back. "Delivered" itself still goes
  through receiving so stock and the shipment never disagree.

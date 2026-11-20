# Take an order off its pickup, back to Booked or To book (20 Nov 2026, #1775)

Branch `fix/1775-pickup-revert` (from `dev`).

## Why it could not go back

- The order page's shipment card (`apps/admin/src/components/shipments/shipment-details.tsx`,
  also the Shipments row's details dialog) had one Cancel: `orders.cancelShipment` without
  `keepPacked`, so the items were unpacked to To ship. There was no "off the pickup" choice and
  no "cancel the AWB, keep it packed, back to To book" choice there. Those two only existed in
  the Shipments row's Cancel… menu (`ShipmentCancelDialog`, 18 Nov).
- `leavePickup` (`packages/core/src/shipping/shipment-cancel.ts`) took the parcel out of manifests
  but never lowered the pickup's `expectedPackageCount`, so the Pickups list kept counting it.
- `returnShipmentToBooked` refused a parcel that was only on a printed manifest (made from a list
  of parcels, no `pickupId`): "not on a pickup".

## Change

- `leavePickup(ctx, row)`: store-scoped manifest update, and the pickup's parcel count goes down
  by one (never below 0). Used by Cancel pickup, Cancel shipment and Already cancelled.
- `returnShipmentToBooked` takes a parcel off a pickup or a manifest-only one; still refuses a
  parcel the courier has collected (`cancelBlock` → `picked_up`) before anything moves.
- The shipment card's Cancel button is now "Cancel…" and opens `ShipmentCancelDialog`: Cancel
  pickup (label kept, back to Booked) or Cancel shipment (Delhivery cancels the AWB, items stay
  packed, order back in To book) or Already cancelled on the courier's app. Each writes an order
  timeline note. Unused `shipmentDetailsContent.cancel*` copy removed (English and Hindi).
- No courier wallet ledger exists (the balance is fetched or typed in), so nothing to refund.
- The courier's own pickup request is left as it is: Delhivery has no pickup-cancel API here;
  it just finds one parcel fewer.

## Tests

- `packages/core/src/shipping/pickup-leave.test.ts` (fake courier, no real API).

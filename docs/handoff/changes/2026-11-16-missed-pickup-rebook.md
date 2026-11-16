# Missed courier pickups can be booked again; "Waiting for pickup" step; Try a PIN layout

- **Missed pickup** (Waimers #2472, #2473, #2475, #2476 on 16 Nov): a parcel stayed linked to a
  pickup whose day passed without the courier collecting it, so "Request pickup" and the Create
  pickup picker never offered it again, and Delhivery's manifest blocks cancel. Now a parcel still
  at the store (`created`) on a pickup dated before today (India time) is free for a new pickup:
  `freeForPickup` in `packages/core/src/shipping/pickup.ts` (used by `attachToPickup` and
  `listUnpickedShipments`), `pickupMissed` in `shipment-state.ts`. The shipment details say the
  pickup was missed and the button reads "Book pickup again".
- **Order page tracker**: a parcel with only a label (Delhivery "Manifest uploaded") showed
  "Picked up · Now"; the first step now reads "Waiting for pickup" until the courier scans it
  (`order-transit-steps.tsx`).
- **Delivery options → Try a PIN**: rows had no spacing; the card body now has a gap, the
  segmented switch is sized to its options, the products picker and insurance switch have help
  lines, and Try sits in the card footer.

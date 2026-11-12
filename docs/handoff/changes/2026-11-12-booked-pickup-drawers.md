# Booked and Create pickup drawers (12 Nov 2026)

Builds on `fix/pickup-date-past` (PR #1632, merged into this branch).

- **Booked drawer** (Figma 905:7783, `create-shipment/booked-drawer.tsx`): after a single booking a
  bottom drawer opens over Create shipment: "Booked with <courier>", the Shipment box (AWB with
  copy, order and customer, delivery by with "in N days", what was charged incl. GST / + insurance,
  the courier wallet left when the courier reports a live balance) and the Next box (Print label;
  Create pickup now; Back to orders). `done-step.tsx` now draws both boxes (the Create shipment
  dialog uses it too, without the pickup button). The page's booked side card moved to
  `booked-side-card.tsx`.
- **Create pickup drawer** (Figma 905:8280 / 906:8464, `create-shipment/pickup-drawer.tsx`): pickup
  location (the courier's registered place the parcels were booked from; one per courier and place),
  day cards Today / Tomorrow / the next working day (a Sunday is skipped; today greys out from 2 pm India time unless a pickup is
  already booked that day), From / To time selects, and "Parcels in this pickup": the parcels it was
  opened for plus the courier's other booked parcels from the same place without a pickup, tickable.
  A day with a pickup already booked shows the "already coming" banner with View pickup, the
  "Pickup booked · 14:00" tag, the time locked to that pickup, "Already in it" and "Add to pickup";
  it joins via `joinPickupId`. Parcels across several couriers or places (bulk) are done one
  place after another.
- `pickup-now-dialog.tsx` now opens the drawer (same props, so the bulk done step uses it too).
  A shipment's "Ask the courier to collect" card (`pickup-form.tsx`) has a Schedule pickup button
  that opens it instead of the inline date and time fields.
- API: new read `shipments.listPickupOptions({ shipmentIds })` (ORDERS_READ,
  `listPickupOptionsForStore`): per courier and place, the booked parcels without a pickup and the
  scheduled pickups from today on with their order numbers. The place rule is shared with
  `schedulePickupForStore` as `pickupPlaceName`. No migration. Covered by
  `packages/api/test/pickup-options.test.ts`.
- Copy: `createShipmentContent.booked` and `.pickupDrawer`, with Hindi.

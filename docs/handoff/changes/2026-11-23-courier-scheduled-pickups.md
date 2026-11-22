# Courier-scheduled pickups: only Cancel shipment stops them

**What (owner, 23 Nov 2026):** RapidShyp schedules its own pickup when a label is booked
(`recordPickupAtBooking`, `packages/core/src/shipping/booking-truth.ts`). That pickup can't be
undone over its API, so "Move back to Booked" / "Cancel pickup" only changed our record while the
courier still came. For such couriers the admin now offers only "Cancel shipment" (the AWB is
cancelled at the courier), with the line "RapidShyp schedules its own pickup when you book. To
stop the pickup, cancel the shipment." Delhivery and the other couriers keep both options.

**How:**

- New courier capability `pickup_at_booking` (`packages/shipping/src/types.ts`), declared by
  RapidShyp (`packages/shipping-rapidshyp/src/client.ts`). It is per courier, not per booking: the
  booking result's `pickupScheduled` still decides whether a pickup row is recorded.
- `packages/api/src/services/courier-pickup.ts` `pickupByCourier(registry, providerId)` gives the
  courier's name for such a courier, else null.
- Server: core `returnShipmentToBooked` refuses with `PickupScheduledByCourier` (a
  `ShipmentActionRefused`, code `SHIPMENT_ACTION_REFUSED`) when `pickupByCourier` is passed;
  `returnStoreShipmentToBooked` now takes the registry and passes it, so the API, MCP and the bulk
  bar are refused too (PRECONDITION_FAILED with that message). Create pickup never offers these
  parcels: `listUnpicked` (Pickups page picker), `listPickupOptions` (Create pickup drawer) leave
  them out, `schedulePickup` skips them (and refuses with a clear message when nothing is left),
  and `describeShipment.canRequestPickup` is false.
- Rows and details carry `pickupByCourier` (courier name or null).
- UI: the Cancel… popup (`shipment-cancel-dialog.tsx`, from the row ⋯ menu and the shipment card
  on the order page / drawer) drops "Cancel pickup" and shows the line; choices live in
  `components/shipments/courier-pickup.ts` (`cancelChoices`). The Shipments selection bar
  (`shipments-bulk-actions.tsx`) leaves such parcels out of Create pickup and Cancel pickup, hides
  the button when every ticked parcel is one, and says how many were left out. The Pickups page has
  no per-parcel remove action; its picker is filtered on the server.
- Copy: `shipmentCancelContent.pickupByCourier`, `shipmentActionsContent.pickupByCourierSkipped`
  (`apps/admin/src/data/shipments.ts`) with the Hindi overlay.

**Tests (run):** core `src/shipping/pickup-leave.test.ts`, api `test/courier-pickup.test.ts` (new),
`test/pickup-options.test.ts`, `test/shipment-details.test.ts`, admin
`src/components/shipments/courier-pickup.test.ts` (new), `shipments-bulk-actions.test.tsx`,
rapidshyp capability test. Typecheck: shipping, core, api, admin.

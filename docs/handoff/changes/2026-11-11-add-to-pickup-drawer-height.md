# Add to an existing pickup; courier drawer keeps one height (11 Nov 2026)

Issues #1514, #1515.

- **Add to pickup.** New `apps/admin/src/components/shipments/pickup-fields.tsx` is used by both
  pickup dialogs (Create shipment's "Schedule pickup" after booking, and Shipments › Booked ›
  Create pickup). It lists the courier's pickups still `scheduled` for today or later, picks the
  soonest one, and offers "New pickup" with day and time. The confirm button says
  "Add to pickup" while joining.
- **Server.** `shipments.schedulePickup` takes an optional `joinPickupId`. `schedulePickup` in
  `packages/core/src/shipping/pickup.ts` joins that pickup when it belongs to the same courier
  and is still scheduled, whatever the place name or date on the form. Without it, the old match
  on day and place applies. Test: `"Add to pickup" joins the picked pickup…` in
  `shipments.test.ts`.
- **Drawer height.** `courier-drawer.tsx` is fixed at `calc(100dvh - 6rem)`. With one service
  the empty space sits below the table.
- **Insurance note.** When the courier gives no insurance price, the note under the drawer's
  switch says the courier bills it on its invoice, not in the listed prices.
- Tested locally: one booked parcel joined an open pickup (count 1 → 2, no second courier
  request), and the drawer stayed full height while loading.

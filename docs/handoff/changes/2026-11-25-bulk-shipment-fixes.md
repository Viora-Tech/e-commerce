# Bulk Create shipment: live prices, pickup choice, imported orders (25 Nov 2026)

Three owner-reported bugs in the admin's bulk Create shipment drawer.

## 1. Weight and size now re-price the row editor as you type

- Cause: the row editor (`bulk-edit-inline.tsx`) showed the row's old quote until Apply; only
  Apply asked the couriers again (`use-bulk-ship.ts` `askOne`). The single-order page asks 600 ms
  after the last edit (`use-ship-quote.ts`).
- Fix: `use-bulk-edit-quote.ts` (`useBulkEditQuote`, `bulkEditAsk`) asks that order's couriers
  for the typed weight, box size or payment 600 ms after the last key, cancelling the ask in
  flight (`debouncedAsk`), and the courier list and charge update in place. While asking, the
  help says "Updating prices…"; half a box size says "Finish the box size…". Apply keeps the
  fetched answer (`saveEdit(orderId, edit, fresh)`) instead of asking again; with no answer yet
  it asks as before.
- Copy: `editPopup.pricing` replaces `repriceNote` (English and Hindi).

## 2. Create pickups asks for the day, or joins a pickup already booked

- Cause: `bulk-pickups-card.tsx` sent `schedulePickup` straight from its button with a small
  day/time select, and joined any upcoming pickup of the same courier without asking.
- Fix: the button opens the single-order Create pickup drawer (`pickup-drawer.tsx`) for all the
  booked parcels whose courier takes pickups: per courier and place, day cards (today greyed
  after the 2 pm cut-off) and time, or "Add to pickup" for a pickup already booked that day.
  Nothing is sent before that choice. The card's rows show "On a pickup" afterwards.
- Copy: `result.footnote` is now one sentence; `onPickup` added; the old slot copy removed.

## 3. Imported orders end fulfilled after a bulk booking

- Cause: `orders.createShipment` (single order) refuses an imported order (`assertNotImported`)
  until it is taken over ("Manage this order in Koomerce"). `shipments.bulkBook` had no such
  check and booked it anyway, leaving it imported: `recomputeOrderStatuses` keeps an imported
  order's statuses from `import_meta`, so the order stayed Unfulfilled and read-only with a live
  label, and the owner had to open each one and click Manage (the takeover recomputes it).
- Fix: `bulkBookShipments` takes each open imported order over first
  (`services/bulk-book-takeover.ts`, as `cancelOrderByStaff` does) in the booking staff's name,
  so it books, packs and turns fulfilled like an order booked from its own page. An imported
  order that cannot be taken over (shipped or cancelled on the old platform) is refused with the
  single-order path's message. The router passes `author: session.user.email`.
- To confirm on production (read only): for the orders the owner had to Manage, check
  `order.import_meta->'takenOver'` (set by the Manage click) and that each had a shipment created
  before that time. Orders booked earlier and never managed still show the Manage card; clicking
  it remains the way to fix those.

## Tests

- `apps/admin`: `bulk-ship-drawer.test.tsx` (new: typed weight and size re-price before Apply),
  `bulk-pickups-card.test.tsx` (rewritten: the drawer asks first; join; refusal),
  `bulk-ship-state.test.ts`, `pickup-drawer.test.tsx`.
- `packages/api`: `test/bulk-book-imported.test.ts` (new), `test/bulk-book-parcels.test.ts`.

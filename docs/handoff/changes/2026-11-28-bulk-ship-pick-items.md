# Bulk ship: pick the items to send in Edit shipment

Branch `feat/bulk-ship-pick-items` (from `origin/dev`). No migration. Owner approved, 28 Nov 2026.

## What changed

In the bulk shipping drawer ("Ship N orders"), each row's **Edit shipment · #N** now lets the
merchant pick what goes in this parcel. Before, "Items to send" was read-only and always shipped
every unfulfilled unit.

- Each item has a tick and a stepper (0 up to the units it still has to send). Unticking sets
  it to 0, and ticking puts back the full count. The header still says "X of Y items".
- With nothing ticked, Apply is turned off and a hint says to tick an item or use "Skip this
  order".
- With some items left out, a note says they stay in To ship. A switch controls whether the
  customer is told the order ships in parts (on by default, as on the order page).
- On Apply, the row shows "Ships X of Y items" and the booking sends only the picked lines and
  quantities. The server splits the parcel first (`splitFulfillmentOrder`, the same call as
  the order page's partial Create shipment). The rest becomes a new open parcel that stays
  unfulfilled in To ship.
- A parcel with no parcel row (older or imported orders), or with only one unit, ships whole
  with no picker, as on the order page.

## What follows the picks (same as the order page's partial shipment)

- **Weight**: `plannedParcel` (partial-plan.ts). A picked line with a weight takes off exactly
  its weight. The rest of the parcel weight (the box, and lines with no weight) comes off by
  unit share. A weight typed for a product with no weight stays until every such item is out.
- **Box and size**: unchanged. The order page does not pick a new box for a partial parcel
  either, so the merchant changes it in the Box select if needed.
- **COD**: the amount to collect is the part's share of the parcel value, by goods value
  (`plannedParcel.valuePaise`). The order page's form uses the same amount. It is sent as
  `perOrder.codAmountPaise`. The declared value (insurance) and the courier quote use the same
  part value.
- **Courier quote**: asked again 600 ms after the last change (`useBulkEditQuote`), with the
  lighter, cheaper part.

## API

`shipments.bulkBook` had no per-line quantities, so this branch adds new optional fields to
`perOrder[orderId]`:

- `keep: [{ orderLineId, quantity }]`
- `splitReason`
- `notifyCustomer`
- `codAmountPaise`

Before an order books, `splitBeforeBooking` (packages/api/src/services/bulk-book-split.ts)
splits the parcel named in `parcelIds`. A refused split (for example, nothing kept) fails only
that order, which books nothing. If the courier then refuses the booking, the split stays, as on
the order page. Core `createShipmentForOrder` already books only a named parcel's unfulfilled
units and accepts `codAmountPaise`, so core is unchanged.

## Files

- Admin:
  - `bulk-edit-package.tsx` (the picker)
  - `bulk-edit-state.ts` (`counts`, `withCount`, `clampCount`, `canApply`, `formParcel`)
  - `bulk-ship-state.ts` (`OrderEdit.keep/notify`, `BulkLine.whole`, `shippingParcel`, the booking payload)
  - `bulk-edit-inline.tsx`
  - `bulk-edit-shipping.tsx`
  - `use-bulk-edit-quote.ts`
  - `use-bulk-ship.ts`
  - new `item-stepper.tsx`, taken out of `partial-picker.tsx` so both share it
- Copy: `data/bulk-ship.ts` and `data/hi/bulk-ship.ts`. `partNote` is reworded and `noneHint`
  is new.
- API:
  - `routers/shipments.ts`
  - `services/shipments-workspace.service.ts`
  - `services/shipment-choices.ts`
  - `services/delivery-booking.service.ts` (type only)
  - new `services/bulk-book-split.ts`

## Tests

- `apps/admin/.../bulk-edit-items.test.ts` (new, run, passes) covers:
  - counts are clamped to what each line still has to send;
  - nothing ticked blocks Apply and asks no courier;
  - weight and value recalculate;
  - the re-quote uses the part;
  - the booking payload carries `keep` and the COD share.
- `packages/api/test/bulk-book-partial.test.ts` (new, **not run**: Docker was not running)
  covers:
  - only the picked units book;
  - the rest is a new open parcel with nothing fulfilled;
  - a keep-nothing split is refused.

  Run it with `docker compose up -d --wait`, then
  `cd packages/api && bunx vitest run test/bulk-book-partial.test.ts test/bulk-ship-per-order.test.ts`.

## How to check on localhost

1. Start the admin on 3200 with the DB up. On Orders, tick two unfulfilled orders, one with 2
   or more items (better, one with quantity 2), and choose Ship.
2. Open a row's Edit shipment. Untick one item, or lower a quantity with −. The header changes
   to "1 of 3 items", the weight drops, and "Updating prices…" shows and then new prices
   appear. On a COD order, "COD · collect ₹…" shows the part's share.
3. Untick everything. Apply turns off and the red hint shows. Tick something again.
4. Apply. The row shows "Ships 1 of 3 items". Book.
5. Open the order. One parcel is booked with only the picked items. A second parcel with the
   rest is in To ship, unfulfilled. The timeline has the "Split to ship in parts" note. On COD,
   the shipment's COD amount is the part's share.

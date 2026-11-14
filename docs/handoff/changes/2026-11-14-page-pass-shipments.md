# Page pass 6: Shipments workspace and Create shipment (audit section 7, row 6)

Branch `design/page-shipments` (from 79a2f8681, dev with wave 2). Visual and UX consistency
only: every booking, courier choice, pickup, label and money flow stays the same. Kept as the
owner asked: the pickup drawer shows only the parcel just booked, the courier rows' hover, the
drawers open beside the sidebar (`BESIDE_SIDEBAR`), and the Select courier table's row layout
(Figma 898:7790).

## What changed

- **One surface for creating a shipment.** One order always opens its Create shipment page
  (Figma 616:16737); several open the bulk ship drawer. The last way into the old 42rem
  single-order dialog (Orders list: tick one order → bulk bar → Create shipment) now goes to the
  page too, with `?courier=` kept when a courier app asked. `CreateShipmentDialog` is the bulk
  drawer plus that hand-off. Deleted, unused after it: `single-shipment-flow.tsx`,
  `courier-step.tsx`, `review-step.tsx`, `flow-steps.tsx`, `courier-option.tsx` (and the card
  style `courierCardClass` only they used). Booking code itself (`book-shipment.ts`, the page,
  the drawer) is untouched.
- **Shipments list** (`/orders/shipments`): a failed read uses ResourceTable's `error` (Try again
  under the same header) instead of an empty state dressed as one; a failed count or courier
  list no longer throws an unhandled error. The "no courier connected" state is EmptyState
  `page` (its own card surface) instead of a raw Card. Loading: its own `ShipmentsListSkeleton`
  (real title, four header buttons, the real ResourceTable with the To book columns, selection
  boxes and pipeline tabs), like Orders.
- **Needs attention and Pickups** (`/orders/shipments/attention`, `/pickups`): on PageBody (they
  had no page gutter or rhythm), and each has its own `loading.tsx` (`ShipmentsSubpageSkeleton`:
  the real cards and table headers) instead of borrowing the Shipments list skeleton.
- **Pickups**: the manifests table is a SimpleTable with headers (Courier, Shipments) and the
  count in copy ("2 shipments" was hard-coded English); Create manifest spins on its own row and
  the buttons wait while it works (double clicks made two manifests).
- **Bulk ship drawer**: loading draws the table's own header over placeholder rows (no spinner
  line); a failed read shows the error with Try again (`useBulkShip().reload`) in place of
  "Close and try again"; the price failure is an Alert (danger, Check again in its action slot),
  and the stray `md:mx-8` (2rem) is gone.
- **Create pickup drawer**: loading is `PickupDrawerSkeleton` (the two boxes at the fields'
  heights); a failure shows Try again; "nothing to pick up" is EmptyState inline; the two boxes
  are `rounded-lg` like every card.
- **Create shipment page** (`/orders/[id]/ship`): loading is `ShipPageSkeleton` (title + back +
  Ship it yourself, the route card's three bands, Package and Summary cards) in both the route
  loader and the page; a failed read shows Try again instead of a dead end. Route card label
  `text-xs` → `text-period` (same as the guard branch).
- Copy: `bulkShip.loadFailed` and `pickupDrawer.failed` drop "Close and try again" (en + hi);
  new `shipments.pickups.manifestColumns`, `manifestShipments` (shipmentsContent has no Hindi
  overlay).

## Tests

- `create-shipment-dialog.test.tsx`: one order → page (with courier), several → drawer.
- `entry-points.test.ts`: no single-order dialog left.
- `pickup-drawer.test.tsx`: failure → Try again → loads.
- `pickups-tab.test.tsx`: manifests header and words; Create manifest disables while busy.
- `courier-row-style.test.ts`: card case removed with the cards.

## Left alone (described, not done)

- **Bulk line edit on top of the drawer** (the 56rem `BulkEditDialog` over the bulk drawer):
  moving the edit into the drawer (a side panel or an expanding row) changes the bulk booking
  screen's layout (Figma 913:9698); it needs an owner decision and its own frame.
- **Drawers on a `full` dialog size**: the four drawers keep the bottom drawer (Figma 898:7790,
  905:7783, 905:8280, 908:8804) with wave 1's scrim, motion, 1rem/500 title and 1rem padding,
  beside the sidebar. Turning them into centred dialogs would cover the sidebar and redo the
  agreed frames.
- **Pickup in three shapes** (pickup drawer, `returns/pickup-dialog`, `change-pickup-dialog`):
  returns is outside this pass; change-pickup picks a place, not a pickup.
- **NDR and Pickups tables on ResourceTable**: they are short fixed queues with no search or
  paging, so SimpleTable (the audit's other allowed table) stays.
- Bulk drawer's rule pills and the courier drawer's mode pills stay hand-drawn toggles (their
  Figma frames); the route card stays its own headless card (Figma 616:16737, also used by
  transfers).

# Partial shipments: ship what is ready, the rest follows as Part 2 (12 Nov 2026)

Figma frames 916:10179 (Create shipment · partial), 918:10520 (To ship · Part 2 row) and
918:10852 (Order · Partly shipped card).

## Back end

- Migration `0243_parcel_split_reason.sql`: `fulfillment_order.split_reason` (text) and
  `customer_told_at` (timestamptz), both nullable. The table's store RLS already covers them.
  (schema.ts sits at its file-size ratchet, so one nearby comment was shortened to make room.)
- `packages/core/src/order/parcel-split.ts`: `splitFulfillmentOrder` takes `{ reason, notifyCustomer, author }`.
  The new parcel keeps the reason (`PARCEL_SPLIT_REASONS`); with notify on and a reachable,
  non-imported customer it queues `order.split` (template `order_split`) and stamps
  `customer_told_at`. Every split adds a timeline note.
- `packages/core/src/order/parcel-availability.ts`: `linesAvailability` (units on the shelf at
  the parcel's location, a waiting pre-order's arrival date from its campaign or line, the next
  open purchase order's due date for a shortfall) and `waitingFor`.
- `packages/core/src/order/parcel-progress.ts`: `orderPartShipping`, returned by `orders.get` as
  `partShipping` (null for an order in one parcel).
- `shipments.splitParcel` accepts `reason` and `notifyCustomer`. `shipments.prepare` lines carry
  `availability`. `shipments.readyToShip` lists one row per open parcel (`id` = parcel id, or
  the order id when it ships whole) with `fulfillmentOrderId`, `part`, `shippedPart`, `items`
  and `waiting`; `toBook` counts those rows. The To book list moved to
  `packages/api/src/services/ready-to-ship.service.ts` (keeps shipments-workspace under 500
  lines). The orders badge (`orders.toShipCount`, shell) still counts orders, not parcels.
- New message `order_split` ("Order ships in parts", a manual message: it only goes when staff
  leave the toggle on): email and WhatsApp copy in
  `packages/notifications/src/templates/content-split.ts`. WhatsApp needs a
  Meta template named `order_split` (same 4 params as `order_link`) before it sends there.

## Admin

- Create shipment: `partial-picker.tsx` ticks what is on the shelf, chips "Pre-order · arrives
  22 Oct" / "1 of 2 in stock", Parcel 1 / Parcel 2 summary, Reason select, "Tell the customer it
  ships in 2 parts" toggle, "This parcel: …". The split runs when booking starts
  (`use-split-plan.ts`); weight, value and COD amount follow the ticked items. The Package card
  moved to `package-card.tsx` (keeps `create-shipment-page.tsx` under 500 lines).
  `?parcel=` opens the page on a given parcel.
- Shipments › To book: "#1042 · Part 2 of 2", "Part 1 shipped 15 Oct", the part's items in the
  Courier column, "Waiting · pre-order 22 Oct". Bulk selection now holds row ids and maps them
  back to order ids before booking (bulk components unchanged).
- Order page: `partly-shipped-card.tsx` replaces the parcels card when an order ships in parts.
- Copy: `createShipmentContent.partial`, `shipmentPartsContent`, `partlyShippedContent`,
  `order_split` in notifications, all with Hindi.

Tests: `packages/core/src/order/fulfillment-orders.test.ts`, `parcel-availability.test.ts`,
`packages/api/test/shipments-ready-to-ship.test.ts`, admin `partial-plan.test.ts`.

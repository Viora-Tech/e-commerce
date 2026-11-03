# Orders list: Delivery status column, dimmed done rows, imported orders complete on delivery

- **Imported Shopify orders** (`importedOrderStatuses`, packages/core/src/order/aggregate-status.ts):
  Shopify calls an order "fulfilled" once a label exists, so every labelled order came in as
  Completed. The importer now reads each fulfillment's `displayStatus` (api-orders.ts, both
  queries; kept in `importMeta.deliveryStatuses` so `recompute` agrees) and maps it like our own
  parcels: label/confirmed → fulfilled (To be picked up), picked up/in transit/out for delivery →
  shipped, all delivered → delivered. Completed only when delivered and paid. CSV imports and
  older cached previews have no stages and keep the old rule. Existing orders change only after
  a fresh orders preview + import.
- **Shopify "closed" is not mapped to archived**: Shopify archives every order once fulfilled
  (#2392, still "Tracking added", is closed), so it would hide almost all orders under Archived.
- **Orders list** (apps/admin/src/lib/order-columns.tsx): the Status column is now "Delivery
  status"; packed orders read "To be picked up", with the courier "In transit".
- **Dimmed rows** (`ResourceTable.rowMuted`, `orderRowDone`): cancelled, completed, archived, or
  everything packed (fulfilled, shipped, delivered, returned), as Shopify greys its rows.
- Counts vs Shopify (4 Nov): Shopify's open unfulfilled/partial list = 43 (= ours 41 + 2
  authorised, which we leave out of "need shipping" until captured); its badge also counts
  archived orders still unfulfilled (#2117, #1979, #1674, #1449, #1301).

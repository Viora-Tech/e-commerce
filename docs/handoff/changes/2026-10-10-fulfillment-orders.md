# Parcels (fulfilment orders), no behaviour change

**Branch** `feat/fulfillment-orders`, from `dev`. **Migration `0096_fulfillment_orders`**: tables
`fulfillment_order` (order, location, GSTIN, position, status open/on_hold/fulfilled/cancelled)
and `fulfillment_order_line` (order line, quantity, fulfilled quantity), column
`shipment.fulfillment_order_id`, RLS, and a backfill. PR 1 of the split-across-warehouses plan
(owner decision 2026-10-10: one order may ship from several warehouses, each parcel with its own
GSTIN, invoice and shipment). Every order still has exactly one parcel here.

- **Where it lives**: `packages/core/src/order/fulfillment-orders.ts` (SOURCE OF TRUTH header).
  `placeOrder` and `convertDraft` create the parcel where they reserved stock; the location's
  linked active GSTIN, else the order's, is the parcel's `gst_registration_id`.
- **Stock moves follow the parcel**, not the variant's selling row: `shipCommittedStock` /
  `releaseCommittedStock` take an optional `locationId` (omitted = selling row, as before).
  Packing (`fulfilOrderLines`, `fulfilRemainingLines`, courier bookings), cancelling
  (`cancelOrder`) and return restock / RTO re-ship (`returnLocation`) all go through it.
  Gift card lines are skipped when packing (they were never reserved).
- **Older orders**: the backfill gives every non-draft order with goods one parcel per selling
  location (in practice the default location), with deterministic md5 ids so it is idempotent;
  `ensureFulfillmentOrders` covers anything else on its next stock move.
- **Deleting order lines** must delete parcels first (`deleteFulfillmentOrders`): checkout
  compensation, Shopify re-import, demo seed cleanup do.
- **Shipments**: `shipment.fulfillment_order_id` set when the booking carries one parcel.
- **Tests (written, not run)**: `packages/core/src/order/fulfillment-orders.test.ts`,
  `packages/db/test/fulfillment-order-backfill.test.ts`. New tables are covered by the
  cross-store leak walk and RLS coverage automatically.
- **Next PRs**: multi-location selling + routing (drop `inventory_level_one_sellable`), GST per
  parcel, invoice per parcel, refunds/credit notes per GSTIN, admin parcels UI.

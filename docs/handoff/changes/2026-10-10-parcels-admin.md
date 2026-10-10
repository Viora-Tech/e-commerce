# Admin: ship online orders from several warehouses, parcels on the order page

**Branch** `feat/parcels-admin`, from `dev` after #382. No migration. PR 6a of the
split-across-warehouses plan (6b: the shopper side, "Ships in 2 parcels").

- **Settings → Locations & warehouses**: "Online orders" column (Ships / Stock only), arrows to set
  the routing order (`businessGst.reorderLocations` → `location.priority`), and a "How orders are
  sent" card with **Most parcels per order** (`businessGst.setMaxParcels` →
  `store.shipping.routing.maxParcels`, written with `jsonb_set` so courier secrets in the same
  column are untouched). Courier pickup column now shows from 2xl up.
- **Location page**: "Online orders" card, switch **Ships online orders**
  (`businessGst.setLocationSelling`; the default location always ships: `DEFAULT_SELLS`).
- **Order page**: `ParcelsCard` ("Ships from" / "Ships in N parcels"): each parcel's location,
  city/state, GSTIN, status, items, packed count, and the **Needs stock moved** badge.
  `orders.get` returns `parcels` (`orderParcelsView`, `packages/core/src/order/parcel-view.ts`).
- Core: `packages/core/src/order/routing-settings.ts`; `LocationBillingView` gains
  `fulfilsOnlineOrders`, `priority`; `BusinessGstView` gains `maxParcels` and lists locations in
  routing order. Copy in `data/business-gst.ts`, `data/orders.ts` (+ Hindi).
- Browser check: own DB copy `commerce_gstcheck`, admin on :3240, light + dark; split order and a
  needs-transfer order placed through checkout code.

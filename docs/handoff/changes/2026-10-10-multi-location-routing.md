# Sell from several warehouses; checkout routes orders into parcels

**Branch** `feat/multi-location-routing`, from `dev` after #362 and #372. **Migration
`0098_multi_location_routing`**: drops `inventory_level_one_sellable` (a variant may now sell from
several locations), adds `location.priority` and `fulfillment_order.needs_transfer`, a trigger
mirroring a location's "ships online orders" + active onto its level rows, and a backfill
(priorities default first then oldest; level rows synced). PR 2 of the split-across-warehouses plan.

- **Routing** (`packages/core/src/order/routing.ts`, ROUTING_RULES header, pure): one location
  with everything (buyer's state, then priority, then most stock), else fewest parcels up to
  `store.shipping.routing.maxParcels` (default 2, no UI yet), else the home location tops up past
  its stock with `needs_transfer` (owner decision: no lost sales). Out of stock only when every
  selling location together is short. Composition GSTIN never ships inter-state:
  `CannotShipToState`, storefront says "We can't deliver this item to your state yet". Pre-order
  lines no stock covers go to an `on_hold` parcel at the home location, limit checked there.
- **Reservation** (`routing-service.ts`, `routeAndReserve`): locks the variants' level rows,
  routes, reserves per parcel location; `placeOrder` and `convertDraft` use it. The order's tax
  origin is the parcel holding the most value (`taxOriginForParcels`; `resolveTaxOrigin` removed).
  GST per parcel is the next PR.
- **Stock reads**: every "stock of a variant" join now uses `sellableStock`
  (`packages/db/src/stock.ts`): cart, storefront catalog/collections, admin product lists, dashboard,
  AI tools, theme import, bulk/duplicate. Product form "Stock" edits land on the primary selling
  row (`primarySellingLevel`) by difference, so the total becomes what was typed.
- **Rollout**: nothing changes for a store until a second location ships online orders; the
  switch, priority order and parcel limit get their admin UI in PR 6 (with the parcel badges,
  "needs stock transfer", and "Ships in 2 parcels" for shoppers).
- **Tests (written, not run)**: `order/routing.test.ts` (pure, every rule incl. composition),
  `order/routing-service.test.ts` (placeOrder end to end), `tax/origin.test.ts` (parcel origin),
  `db/test/multi-location-routing-backfill.test.ts`.

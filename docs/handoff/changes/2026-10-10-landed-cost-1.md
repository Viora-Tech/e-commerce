# Landed cost step 1: suppliers, charges, inbound shipments, weighted average cost

Branch `feat/landed-cost-1`. **Migration `0094_landed_cost`** (snapshot `meta/0094_snapshot.json`,
journal idx 89, chained after `0093_discount_product_values`).

## What changed
- **Schema** (`packages/db/src/purchasing-schema.ts`; `purchase_order` and `purchase_order_line`
  moved here out of `schema.ts`, which was at its size ceiling): `supplier`, `inbound_shipment`,
  `purchase_charge`, `purchase_charge_split`, `purchase_order_receipt`,
  `purchase_order_receipt_line`. `purchase_order` gains `supplier_id`, `inbound_shipment_id`,
  `fx_rate` (numeric 18,6, INR per unit) and status `cancelled`; lines gain `unit_price_minor`
  (supplier currency), `hsn_code`, `rejected`, `landed_unit_cost_paise`, `costed_units`,
  `booked_cost_paise`. RLS by `apply_store_rls()`; the cross-store leak test seeds the new tables
  automatically (it passes).
- **Data migration**: old `shipping_paise` became a `freight_local` charge (cost, by value) and old
  `tax_paise` an `other` charge marked recoverable (GST input credit). Both columns are no longer
  read or written. `unit_price_minor` backfilled from `unit_cost_paise`.
- **Core** (`packages/core/src/inventory/`): `landed-cost.ts` (pure: FX, largest-remainder splits,
  landed unit cost, WAC, revaluation, amount parsing; client-safe via `@commerce/core/inventory`),
  `costing.ts` (`lockCostingGroup`, `loadCosting`, `recost`), `charges.ts`, `suppliers.ts`,
  `inbound-shipments.ts`, `receiving.ts` (receive with accepted/rejected at landed cost), and
  `purchase-orders.ts` (currency, FX, HSN, supplier link, cancel, reopen; draft edits keep line
  ids).
- **API**: `suppliers.*`, `inboundShipments.*` (incl. `attach`, `detach`, `costs`),
  `purchaseCharges.add/update/remove`, `purchaseOrders.cancel/reopen/costs`;
  `purchaseOrders.receive` now takes `{ lineId, accepted, rejected }` and returns
  `{ units, rejected, receiptId, lines[] }` with cost before/after. `save` takes `supplierId`,
  `currency`, `fxRate`, `lines[].unitPriceMinor`, `hsnCode` (no more `shippingPaise`/`taxPaise`).
- **Admin**: supplier picker with "New supplier" on the PO, Currency card (rate), unit price in
  the supplier currency and HSN per line, Charges card (add/edit/remove, split method, input
  credit toggle, fallback warnings), Landed cost card, receive dialog with accept/reject and
  "Cost ₹500 → ₹650", Cancel and Reopen. New pages: Products › Suppliers and Products › Inbound
  shipments (list + detail with orders and shared charges). Copy in `data/purchasing.ts` with a
  Hindi overlay.
- **Docs**: merchant guide "Purchase orders and landed cost"; developer data model section
  "Purchasing and landed cost".

## Rules worth knowing
- Product cost = weighted average cost across all locations, set on receipt. Late charges revalue
  only the share of costed units still on hand; sold units keep their cost (no COGS adjustment
  is recorded yet: step 3).
- Rounding: half up, away from zero for negatives, BigInt throughout; splits sum exactly.
- Unknown cost (`cost_paise` null) with stock on hand: the landed cost becomes the cost.
- Charges on received, closed orders are allowed (late bills); on cancelled orders they are not.

## Not done / next
- Step 2 document upload and AI extraction, step 3 profit reports and COGS on orders, step 4
  PDF/email to supplier.
- Not checked in a browser in this session (no dev server run against a migrated dev DB).
- The Products redesign PR touches the same PO pages; expect a merge on the PO components.

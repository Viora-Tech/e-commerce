# Weight per product on purchase order lines (#1054)

- The purchase order's Products card has a **Weight (g)** column
  (`components/purchase-orders/line-weight-input.tsx`). It saves on blur through the new
  `purchaseOrders.setLineWeight` → core `setPurchaseLineWeight` (`inventory/line-weight.ts`), which
  writes `variant.weight_grams` (only for a product on that order) and `recost`s the order's costing
  group, so by-weight freight re-splits across the shipment.
- It sits outside the order form state, so it never marks the order unsaved, and works in every
  status (packing lists arrive with the goods). Disabled until the order is saved.
- `getPurchaseOrder` lines now carry `weightGrams` (from `lineDetails`). Guide: purchase orders →
  "How a charge is split". Tests: "weights from the packing list (#1054)".

# Inventory: "Bulk edit" opens a stock sheet for a big restock (#1033)

The inventory bulk bar could only apply one number to every ticked SKU (Adjust by / Set on hand
to). A restock needs a different count per SKU.

- Inventory's selection bar gets **Bulk edit**: it opens the products bulk editor
  (`routes.products.bulkEdit(ids, { reason })` → `?focus=stock&reason=…`) for the ticked SKUs'
  products, showing only title, variant, SKU and the per-location stock columns
  (`STOCK_FOCUS_HIDDEN`). That view remembers its own columns (`inventory-bulk-edit:hidden-columns`),
  apart from the full products sheet.
- `products.bulkEdit` takes an optional `stockReason` (core `bulkEdit(…, { stockReason })`), so
  on-hand changes are logged with the Inventory page's **Reason for edits** (e.g. `received`);
  without it they stay `correction`. Undo still logs `correction`.
- Merchant guide: Stock → Inventory explains it.

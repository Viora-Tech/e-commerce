# Inventory: one row per product with expandable variants (#828)

Branch `feat/inventory-product-tree`. No migration.

- **Default view is Products** (`?group=product`, or no `group`); `?group=variant` is the SKUs
  view. A product with two or more SKUs is one summary line (image, title, "N variants", and
  available / committed / incoming / on hand summed at the selected location, read only).
  The chevron (a button with `aria-expanded`) or a click on the row folds its SKUs open
  underneath, indented, each with the usual available cell, history button and checkbox. A
  single-SKU product stays its SKU's own line, edited inline. "Expand all / Collapse all" sits
  next to the Show toggle. Open lines are local state and survive a refresh after an edit.
- **Paging:** the API already paged by product for `group: 'product'` (`listInventoryByProduct`
  in `packages/api/src/services/inventory.service.ts`), so a product's SKUs never split across
  pages and `total` counts products. Rows now also carry `productImageUrl` (the cover).
  `exportRows` always reads by SKU (keeps the 5,000-line cap; SKU order already keeps products
  together).
- **Tree tables:** `ResourceTable` takes an optional `tree` prop (`getSubRows`, `expanded`,
  `onExpandedChange`), built on TanStack's expanding feature (registered in
  `resource-table/features.ts`). Sorting keeps sub rows under their row; only leaves are ever
  selected, and a parent's checkbox ticks its sub rows (full or dash). Other tables are
  unchanged (no `tree`, no sub rows).
- Code: `components/inventory/inventory-tree.ts` (grouping, pure), `product-line-cell.tsx`,
  `app/(admin)/stock/inventory/inventory-query.ts` (URL state, split out of the page).
- Tests: `inventory-tree.test.ts`, `resource-table/tree.test.tsx`, and a product-paging case in
  `packages/api/test/inventory.test.ts`.

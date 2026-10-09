# Admin redesign: Products (Proofly look)

Branch `feat/proofly-products`. Figma `YmMNC5JOimqg61sI0eFI5a`, "Products / ..." frames. Presentation only; no migrations.

## Pages
- Products list: `ProoflyListPage` (title, summary line, stat tiles that filter: total, low stock, out of stock, draft), status pills with counts, centred status chips, row menu, rows per page (`siteConfig.ui.rowsPerPage`, URL `perPage`). `products.stats` gained `draft` and `lowStock`.
- Product detail and new: Proofly header (back link, status chip, summary), next-step banner (`product-banner.tsx`: out of stock, running low, draft, archived), floating cards. All sections, media, variants, SEO and actions kept; the duplicate bottom Publish buttons and the header search are gone (header has Start another, Save to draft, Publish).
- Collections list: now lists collections (title, products, type with rule summary, visibility, updated), tiles All/Automatic/Manual/Empty as filters. It no longer lists every product.
- Collection detail: two columns (title and description, conditions for automatic, "Products in this collection" with search, sort, drag reorder, pagination; image, visibility, type (locked after create), search listing, theme template). Manual: add via Select products, remove, reorder. Automatic: read only members plus conditions. `collections.list` returns `rules`; `getCollection` members carry stock and price.
- Inventory (tabs All/Out of stock/Low stock, location and reason pickers, tiles), Purchase orders, Transfers, Gift cards lists on the same shell and rows per page.
- Purchase order, transfer and gift card detail/new: Proofly header and page frame (inner cards unchanged).

## Select products dialog
`components/products/select-products-dialog.tsx` (copy `data/select-products.ts`, Hindi overlay). Search by name or SKU, collection/type/status filters, variant expansion with a partial tick, already added rows locked, "Show selected only", footer count and Add. Backed by `products.pick`. Used for Add products on a manual collection.
**Not yet wired** to purchase order and transfer lines, which keep their own variant search (`po-lines-card`, `transfer-lines-card`); swap them to the dialog next.

## Shared pieces added
`ProoflyPageHeader`, `ProoflyListPage`, `ProoflyDetailPage`, `ProoflyPageBody` (layout), `RowMenu` (table), `StatTile` now shows `trendNote` alone as a note line.

## Not done
- "Schedule a date" on collection visibility (no data).
- Stat trend lines (no history data), so tiles show counts only.
- "All products" sidebar child (nav is the shell's).
- Out-of-stock/draft/archived product variants beyond the banner, transfers and PO detail polish against every Figma state.
- `admin-routes` allow-list lowered for every migrated file.

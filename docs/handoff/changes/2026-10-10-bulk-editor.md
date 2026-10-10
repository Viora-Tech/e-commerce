# Bulk editor

Branch `feat/bulk-editor`. No migration. New dependency `react-data-grid@7.0.0-beta.61` (MIT, React 19.2; Glide Data Grid was rejected: React 18 peers, canvas rendering that ignores our tokens, dark mode and Hindi text). Credited in `THIRD_PARTY_NOTICES.md` and `apps/admin/THIRD_PARTY_LICENSES.md`.

- Products list: select rows, "Bulk edit" opens `/products/bulk-edit?ids=...` (`routes.products.bulkEdit`).
- Sheet: one row per live variant; columns title, status, vendor, type, tags, price, compare-at, cost, SKU, barcode, weight, HSN, GST %, stock per active location. Product cells repeat on a product's rows and stay in sync. Changed cells are tinted, invalid cells red with a list above the grid. Paste a block from Sheets/Excel, drag the fill handle, or Ctrl+D.
- One Save. Undo is a toast action that sends the server's `undo` rows back.
- API: `products.bulkEditSheet` (read) and `products.bulkEdit` (`PRODUCTS_WRITE`, `INVENTORY_WRITE` too when a stock cell is sent, `heavy('bulk')` rate limit, max `BULK_EDIT_MAX` = 500 rows). Core: `catalog/bulk-edit.ts` validates every row first (variant in this store via RLS, no duplicate row, product cells agree, compare-at >= price, HSN 4-8 digits, SKU unique in the sheet and in the store, locations in this store), then writes all in one transaction or nothing, returning per-row errors `{variantId, field, message}`. Stock goes through `setStock` (ledger, reason correction, note "Bulk edit"). Automatic collections are re-synced after a save.
- Tests written, not run (owner rule): `packages/api/test/products-bulk-edit.test.ts`, `apps/admin/src/components/products/bulk-edit/bulk-edit-model.test.ts`.
- Left: no column picker, sort or filter inside the sheet; products with more than 500 variants are cut (warning shown); copying a range out of the grid copies one cell.

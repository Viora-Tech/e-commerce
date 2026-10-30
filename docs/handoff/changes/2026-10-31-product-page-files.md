# Product page: variants, sales, HSN once per product; Files folders (31 October 2026)

Admin audit findings #54, #56, #63 and #91. Pushed straight to `dev`, one commit per finding.

## #54 Variants card

- Options fold into chips (`option-chip.tsx`); clicking one opens its editor (`option-editor.tsx`)
  with Done. An option with no name or no value stays open.
- "Group by <option>" above the table (`variant-toolbar.tsx`): one summary row per value,
  "Mini · 5 variants · ₹1,299–₹1,499 · 42 in stock", opening to its rows. On by itself (first
  option) from 9 variants with two options or more.
- Search by variant title or SKU (opens every group while typing) and the total stock line.
- Bulk edit unchanged: a group row's checkbox ticks its variants, select-all ticks what is shown.
- Pure logic and tests: `components/products/variant-groups.ts` (+ `.test.ts`).

## #56 Sales past 90 days

- `products.sales` (orders:read) → `services/product-sales.service.ts`: lines of the product's
  variants in `counted` orders (no drafts, test-mode or cancelled, same filter as reports),
  placed in the last 90 days; gift-card lines skipped.
- Net revenue = line value less the product's share (by goods value) of each order's discount
  and processed/manual refunds; maths in `services/product-sales.ts`, tested in
  `packages/api/test/product-sales.test.ts`.
- Card in the product page's side column (`product-sales-card.tsx`), hidden without
  orders:read. "View N orders" opens `/orders?product=<title>&date=90d` (the Orders Product
  filter is a text match on line title/variant/SKU, so a similarly named product can show up).

## #63 HSN and GST once per product

- Migration `0204_product_tax`: `product.hs_code`, `product.gst_rate_percent`.
- Rule (`packages/core/src/catalog/effective-tax.ts`): a variant's own value wins, else the
  product's; a null rate still means the store default. Used by checkout (`place-order.ts`),
  the cart GST preview (`cart-gst.ts`), drafts (`drafts.ts resolveLines`, which since ffa9a6f7
  snapshots the rate and HSN onto draft lines, so drafts now snapshot the effective values), order
  edits (`edit.ts`), customs on shipments (`shipments.ts`) and invoices (`plugin-gst-invoices
  issue.ts`, fallback when a line has no snapshot).
- Product page: HSN and GST rate on the Shipping tab for every product (`product-tax-fields.tsx`),
  with "Different per variant" for products with options. Off: saving clears the variants' own
  values so the product's apply. On: the variant dialog shows its own HSN/GST, blank uses the
  product's (shown as placeholder).
- Opening a product lifts a value every variant shares into the product field; variants that
  disagree open with "Different per variant" on (`product-tax.ts`, tested).
- "1 to fix: No HS code" and the GST app's Edit both focus `#product-hs` directly.
- Not changed: the bulk editor still edits variant HSN/GST (they act as per-variant overrides).

## #91 Files: folders, alt text column, readable names

- Migration `0206_media_folders`: `media_folder` (one level, name unique per store ignoring
  case, store RLS), `media.folder_id` (set null if a folder ever goes), `media.name`.
- Core `media/folders.ts`: list (with counts), create, rename, delete (refused while the folder
  holds any file), move files in or out. API: `media.folders`, `createFolder`, `renameFolder`,
  `deleteFolder`, `moveToFolder`; `media.list` takes `folderId`.
- Content › Files: folder chips above the table (`?folder=<id>`), New folder, Rename/Delete on
  the open folder's ⋯ (dialogs, no drawers), "Move to folder" on every file's ⋯. An upload made
  while a folder is open goes into it. The file picker gets a Folder filter once a folder exists.
- List view: an alt text column edited in place (Enter or leaving the field saves).
- Readable names: new uploads keep the uploaded file's name in `media.name`; older and imported
  files show a name read from the key (timestamps, hashes and "original" dropped; a key that
  leaves only "image" shows the alt text). `key` and `url` never change. Search and "Name" sort
  include `media.name`. Pure logic tested in `components/media/file-meta.test.ts` and
  `packages/core/src/media/display-name.test.ts`.
- Left out: moving many files at once (one file per move), nested folders, renaming a file's
  display name from the UI (the API takes `name` on `media.update`).

## How to test

- Product with 3 × 5 options: chips, group by Size, search "red", tick a group, bulk-set a price.
- Product with orders: Sales card numbers vs Analytics › Reports › Sales by product (gross) for
  90 days; test and cancelled orders must not count.
- Product with 15 variants and no HSN: "No HS code" → lands in the HSN field; type it once,
  save; place an order and issue the invoice: the HSN prints. Turn on "Different per variant",
  set one variant's HSN, save, check that variant's invoice line.
- Files: make a folder, move two files into it, open it, upload a file (lands in it), try to
  delete it (refused), move the files out, delete it. In the list view, type alt text and press
  Enter. A Shopify-imported file shows a readable name. Open any image field's picker: Folder
  filter.
- Run `bun run db:migrate` (0204, 0206) before testing.

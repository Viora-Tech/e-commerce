# Product page pass: fields, app sections, stock enum

Owner-led UI review of the product page on dev (22 Oct 2026).

## Fields
- Description editor gets top/bottom padding on the product page (shared editor root untouched). The rich-text
  editor now starts with an empty paragraph, so the caret sits inside the padding on every page
  (`packages/editor/src/editor.tsx`).
- Price & tax: a live "Price incl. GST · excl. GST (GST at R%)" line under "Charge tax", from the variant's rate
  or the store default; "No GST charged" when off, 0% or composition. `products.facets` returns
  `gst: { ratePercent, composition }`.
- SKU: "Generate" beside the SKU field and on empty variant rows (`products/sku.ts`, e.g.
  `YUKI-MECHA-GLASS-BLK-L`, clashes get -2, -3). "Suggest SKUs" uses the same rules and only fills blanks.
- Option suggestions: Size, Colour, Material, Style, Length, Weight, Capacity, Storage, Pack size with common
  values, merged with the store's own (`facets.options`, store values first).
- Vendor: free-text combobox (`fields/combo-input.tsx`), Suppliers first, then vendors used on other products.
- Weight unit: `variant.weight_unit` (g/kg/lb/oz, null shows as kg; migration `0145_variant_weight_unit`).
  Grams stay the saved value; switching unit converts the number; writes without a unit keep the saved one.

## Stock status is one enum
`packages/core/src/catalog/stock-state.ts`: `STOCK_STATES` (`in_stock`, `low`, `out`, `unlimited`),
`stockStateOf`, and the URL filter values (`?stock=in|low|out`, unchanged). Low stock now follows the store's
`low_stock_threshold` everywhere (product list filter and ids, product tiles, dashboard, inventory, activity
feed, product page chip and banner) via `storeLowStockThreshold`; 5 is only the fallback.
`products.facets` returns `lowStockThreshold`. Stock status shows as a coloured chip.

## Layout and apps
- Theme template card moved to the right sidebar (`product-side.tsx`).
- "More" tab shows one section per installed app (`apps/product-sections.ts`): Reviews (count, latest 3),
  Back in stock (waiting shoppers per variant), GST invoices (HSN, rate). Empty state links to the App store.
  Pre-order and stock history moved to Price & stock (or Variants).
- More actions: Archive / Unarchive, then each installed app's actions under its name
  (`apps/product-actions.ts`).
- Search tab: social share card next to the Google preview, using the first non-video photo. No stored
  share-image override yet (needs a column).

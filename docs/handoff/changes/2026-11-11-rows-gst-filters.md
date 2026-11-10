# 11 Nov 2026: middle-click on rows, GST Products page, "No box" filter

- **Middle-click on table rows (#1492).** Rows opened from `onClick`, and a middle click fires
  `auxclick`, so it did nothing. `components/table/open-row.ts` now handles both for `LinkRow` and
  `ResourceTable`: left click opens in the tab; middle, Ctrl/⌘ or Shift-click opens a new tab;
  clicks on controls inside the row and text selections are left alone. Test: `link-row.test.tsx`.
- **GST invoices › Products.** Each row shows the product's first photo and opens the product
  from a click anywhere on it. New filter **Missing GST rate** (`missing_rate`): a variant with
  no rate of its own or on its product, so it falls back to the store rate. Its copy moved to
  `data/gst-product-tax.ts` (the GST copy file passed 500 lines).
- **Products › Missing › No box** (`missing=box`): products with a live variant that has no box
  from Settings › Shipping. Fill them with the existing bulk **Set weight and box**.
- `routers/orders.ts` was 508 lines on dev (file-size sweep failing): the courier-panel check moved
  to `assertCourierConnected` in `shipping.service.ts`, and courier calls share
  `routers/courier-args.ts`.

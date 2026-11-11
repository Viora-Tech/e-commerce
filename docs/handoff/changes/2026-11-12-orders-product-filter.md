# Orders: Shopify-style Product filter (#1609)

Orders list → Filter → **Product** now opens a picker like Shopify's, not a text box.

- **Picker** (`components/orders/product-filter-picker.tsx`, with `product-filter-row.tsx` and
  `product-filter-variants.tsx`): the store's products with picture and tick box, found by
  title or SKU (a SKU match names the variant under the title), 30 at a time with the next page
  loading on scroll (or "Show more"). › opens a product's variants to tick single sizes, with
  "All variants" on top. An Is / Is not switch turns the filter around. Every tick applies at once.
- **Chip**: "Product is Hachiware ICE Glasspad, +2" or "Product is not …". Clicking it reopens
  the picker; × clears the picks and the switch. The filter panel got a generic `picker` group
  type (`components/table/filter-panel/types.ts`, `PickerGroup`) and `AppliedFilter.negated`,
  which `filter-chip.tsx` reads as "is not" (`tableContent.filterIsNot`).
- **Picks** (`lib/product-filter-selection.ts`): whole products and single variants. Ticking
  every variant of a product keeps it as the product; unticking one variant of a whole product
  keeps the rest. Chip names come from the rows the merchant ticked, and picks that arrived with
  the URL are looked up by id (`components/orders/use-product-filter-names.ts`).
- **URL**: `?productIds=a,b&variantIds=c&productNot=true` beside the other filters
  (`FILTER_PARAMS`), so reload, back/forward and shared links keep it. Orders has no saved views
  beyond the URL and its tabs; the tab badges are store-wide counts (not filtered by any panel
  filter), the "Custom" count is the filtered total and respects this filter.
- **Old filter kept**: the free-text filter is still there as "Product title or SKU", so
  `?product=pd170` links and bookmarks keep working.
- **API**: `orders.list` / `orders.ids` take `productIds[]`, `variantIds[]` (100 each) and
  `excludeProducts`. One `exists (select 1 from order_line join variant …)` per order; with
  `excludeProducts`, `not exists`. Uses the existing indexes `order_line_order`,
  `order_line_variant` and the variant primary key, so **no migration** (0242 not used).
  `products.pick` gained `offset` (paging) and `ids` / `variantIds` (look up by id, archived
  products and variants included, so an old order's product still names itself).
- Tests: `packages/api/test/order-product-filter.test.ts`,
  `apps/admin/src/lib/product-filter-selection.test.ts`.
- Owed: a browser check of the picker on the test server (popover width on a phone, scroll
  paging, Is / Is not, reload with picks in the URL).

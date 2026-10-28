# Filters F2: Products, Inventory, Collections, Gift cards

Second step of the admin filters plan (F1 added the shared multi, date and yes/no groups).

- **Products**: Collection, Vendor, Product type and Tag are multi-picks ("any of"); new Price
  range (some live variant priced in it) and Created date (presets or custom). Search also
  matches a variant SKU. `products.list` / `exportRows` take `vendors`, `productTypes`, `tags`,
  `collectionIds`, `priceMinPaise`, `priceMaxPaise`, `createdFrom`, `createdTo`; the old single
  `vendor` / `productType` / `tag` still work (MCP, old links). `products.facets` returns
  `collections`. State lives in the URL (`lib/product-list-filters.ts`); `?vendor=Acme` links
  still open with Acme picked.
- **Inventory**: Collection, Vendor, Product type, Tag (multi) and Product status (active,
  draft). `inventory.list` takes the same arrays plus `productStatus`; `inventory.facets`
  returns `tags` and `collections`.
- **Collections**: a filter panel (Visibility, Has image, product count, Updated date), filtered in
  the browser like the list's search (`lib/collection-list-filters.ts`). Search also matches the
  handle.
- **Gift cards**: Source, Balance range, Date issued and Expires (custom range).
  `giftCards.list` takes `source`, `minBalancePaise`, `maxBalancePaise`, `createdFrom`,
  `createdTo`, `expiresFrom`, `expiresTo` (`listGiftCards` in core).

Tests: `apps/admin/src/lib/catalog-list-filters.test.ts`,
`packages/api/test/catalog-list-filters.test.ts`.

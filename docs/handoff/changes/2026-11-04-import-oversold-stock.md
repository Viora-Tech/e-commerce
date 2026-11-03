# Shopify import keeps oversold (negative) stock

- e6c733831 made the importer pass Shopify's negative stock through (−7 = 7 sold beyond stock),
  but `setStock` → `adjustStock` still refused to take a tracked variant below zero, so every
  product with an oversold variant failed with "Stock cannot go below zero" (25 of 316 on Waimers,
  4 Nov 2026).
- `AdjustStockInput.allowNegative` (packages/core/src/inventory/levels.ts). Only
  `createProduct`/`updateProduct` with `{ imported: true }` set it, through
  `setOptionsAndVariants`. Admin saves, orders and adjustments still stop at zero.
- Test: packages/core/src/catalog/products.test.ts "keeps an import's oversold stock".
- After deploy: Apps → Shopify importer → Retry the 25 that were missed.

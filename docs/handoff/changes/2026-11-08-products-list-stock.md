# Products page: stock tiles and rows without whole-store stock scans (8 Nov 2026)

- **Stock tiles** (`packages/api/src/services/product-stats.service.ts`): "Out of stock" and
  "Low stock" each ran a stock sub-query for every product (2 × all products). Now each
  product's sellable units are summed once (grouped by product), and both tiles count from that.
  The rules are the same: archived variants are left out, and a product with no variants is out of stock.
- **List rows** (`listProducts` in `product.service.ts`): select only the columns a row shows
  (not the description, SEO and pre-order fields), and sum stock only for the page's variants
  through the new `sellableStockForProducts(ids)` (`packages/db/src/stock.ts`, next to
  `sellableStock`, which groups every selling row in the store before the join).
- Test: `packages/api/test/dashboard.test.ts` now also checks `outOfStock`, including a product
  with no variants. Not run locally: no Postgres on the machine that wrote it.

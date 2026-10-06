# Product page blank for products with no variants

- **Bug:** opening a product that has no variants (Shopify "historical" items brought in by the
  importer) showed an empty page: the product form returned nothing when there was no first variant.
- **Fix:** `fromProduct` (`apps/admin/src/components/products/form-state.ts`) gives such a product
  one empty variant row, so the editor renders; saving asks for a price like any new product.
- **Test:** `form-state.test.ts` → `fromProduct` gives a product with no variants one row.

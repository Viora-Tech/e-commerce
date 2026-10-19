# Shopify import brings pre-orders over

Branch `fix/import-preorders`. No migration.

- After products, the API import reads Shopify's selling plan groups (`fetchPreorderProductIds`
  in `shopify-api.ts`). Products in a group named or coded like "Pre-order" get
  `product.preorder_enabled` switched on (`applyPreorders` in `write-products.ts`), so they sell
  with the "Pre-order" button instead of showing Sold out. It only ever switches pre-order on.
- Needs the new optional scope `read_purchase_options` (listed in `ALL_SCOPE_HANDLES`, admin
  scope names, merchant docs). Without it, or on any failure in this step, the products still
  import and one issue on the run says pre-orders were left out.
- CSV imports have no purchase options and are unchanged.

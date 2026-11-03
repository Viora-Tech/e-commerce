# Purchase order lines: full name on hover, open the product in a new tab (#1042)

Long product and variant names were cut off on the purchase order page with no way to read them.

- Each line's name is wrapped in a tooltip showing the full "Product / Variant".
- The name links to the product (`routes.products.detail`) in a new tab; an external-link icon
  appears on hover or keyboard focus, and screen readers hear "Open product in a new tab".
- `lineDetails` (purchase-order.service.ts) now returns `productId`, carried on `PoLine` and set
  when lines are picked (`PickedForPo.product.id`). Copy in `data/inventory.ts` + Hindi overlay.

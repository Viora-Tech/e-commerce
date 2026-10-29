# Products without a price, and the product page on one page (#913, #914)

Branch `fix/product-form-913-914`. Migration `0182_variant_price_optional` (`variant.price_paise`
drops NOT NULL; no data changes).

## #913: list a product before its price is confirmed

- **Admin:** the price field is optional (help text says what blank means). `toWrite` sends
  `pricePaise: null` for a blank price; `formErrors` only stops a price that is typed but not a
  number (`errors.priceInvalid`). Works for draft and active products. Bulk edit can clear a
  price too (`BulkEditVariantPatchSchema.pricePaise` is nullable).
- **Never sold:** `addToCart` throws `PriceNotSet` (`PRICE_NOT_SET`) for a variant with no price,
  and `placeOrder`'s `loadCart` re-checks the live variant price, so a price withdrawn after the
  item went in a cart stops checkout (storefront shows `checkout.errors.priceNotSet`). Draft
  orders and order edits need the line's own price (`PriceNotSet` / `OrderEditRefused('no_price')`);
  the admin pickers show "No price yet" and start the line at ₹0 for the merchant to type over.
- **Storefront:** `Price` (blocks) renders "Price coming soon" for `pricePaise: null`; the buy
  button reads the same and stays disabled (not "Sold out", no back-in-stock form); `purchasable`
  is false; card price is the cheapest priced variant (`cheapestPriced`), quick add is off for an
  unpriced one; price sorts put unpriced last; predictive search says "Price coming soon".
- **Elsewhere:** JSON-LD makes no offer for an unpriced variant; Google/Meta feeds
  (`sales-channels/catalog.ts`) skip it; Liquid themes get `price: 0` with `available: false`;
  pixels send no value; AI price changes skip it; reports count it as ₹0 retail value;
  `priceRange` (core catalog) gives min/max over priced variants for lists and pickers.
- `CardProduct.pricePaise`, `ProductDetail.variants[].pricePaise`, `LoopProduct.pricePaise` and
  `VariantInput.pricePaise` are now `number | null`.

## #914: the product page is "too cluttered"

- New product layout `page` (Account › Appearance › Product page layout: One page · Settings ·
  Tabs), now the default (`DEFAULT_PRODUCT_LAYOUT`). It stacks every section on one page in
  Shopify's order: title and description, then media and custom fields, then price & stock or
  variants, shipping, search, and More only when an installed app adds a section. "On this page"
  and `?tab=` links scroll to a section instead of switching tabs. Members who picked Settings or
  Tabs keep them; the overview tab now also puts title and description above the photos.
- Variants table rows are read-only (image, title + SKU, price or "No price yet", stock, Edit);
  each row opens `VariantEditDialog`, a centred dialog with every per-variant field (price,
  compare-at, cost, SKU + generate, barcode, track quantity, quantity, GST, GST rate, weight,
  HSN, country of origin), Previous/Next and Cancel/Done on the right. Edits are a draft until
  Done; the page save bar saves them. With options, the Shipping card keeps only the package and
  points to the dialog (it used to edit variant 1's weight and customs for all).
- Save: a validation stop or a server error now also shows a toast, so the side column's bottom
  "Save changes" never fails silently (its error banner was at the top of the page, out of view).

Tests: `cart.test.ts`, `place-order.test.ts`, `products.test.ts`, `variants.test.ts`,
`preorder/settings.test.ts` (core); `seo.test.ts`, `card-preorder.test.ts` (storefront);
`form-state.test.ts` (admin).

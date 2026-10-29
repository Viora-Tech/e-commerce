# Hide variants on the store; ₹0 price warnings (#934)

Branch `feat/variant-hide`. Migration **0185_variant_hidden_on_store** (`variant.hidden_on_store`
boolean, default false). 0184 is left for Rollouts R1b (#944); see "Migration order" below.

## Hidden variants

- `variant.hiddenOnStore`: never shown, priced or sold on the storefront, kept in admin,
  orders and history. `VariantInput.hiddenOnStore` is optional; undefined keeps the stored value
  (`product-rows.ts`), so imports and bulk tools never unhide a variant the merchant hid.
- Checkout errors moved from `cart-actions.ts` into `checkout-errors.ts` (kept the file under the
  500-line cap).
- Storefront reads filter it out: `apps/storefront/src/lib/catalog.ts` (product page, cards,
  quick add), `collections.ts`, `seo-files.ts` (sitemap / llms prices), core `catalog/browse.ts`
  and `search-sql.ts` (search and collection price ranges), `collections/service.ts`,
  `plugin-meilisearch`, `theme-import/product-data.ts` and `custom-data.ts` (imported Shopify
  themes' variant JSON), `sales-channels/catalog.ts` (Google, Meta, OpenAI feeds),
  `dynamic-sources/*`, `metaobjects/storefront.ts`.
- Option values only hidden variants use are dropped from the product's options (our themes and
  imported themes), so "Purple" disappears from the picker when Purple is hidden.
- Server enforcement: `addToCart` throws `VariantHidden`; `placeOrder` re-checks the cart
  (hidden after it was added) and the checkout shows "An item in your cart is no longer
  available". Drafts and order edits (staff) still accept hidden variants.
- Admin: **Visibility → Hide on store** switch in the variant dialog; "Hidden" chip in the
  variants table and on the Inventory page (SKU rows; a product line when every SKU is hidden).
- API / MCP: `products.save` (through `VariantInput`) and `products.updateVariant`
  (`hiddenOnStore`) both take it.

## Shopify import

- The Admin API importer now asks for `availableForSale`. A variant is imported hidden when
  Shopify will not sell it **and** its price is ₹0, the "unavailable" leftovers from #934. A
  sold-out variant with a real price stays visible (sold out); a ₹0 variant Shopify sells (free
  item, or pre-order with "continue selling") stays visible with the ₹0 warning.
- Re-import only ever hides, never unhides.
- The product CSV has no availability column, so a CSV import cannot tell; nothing is hidden.

## ₹0 warnings (admin only, nothing blocked)

- `zero-price-warning.tsx`: "Price is ₹0, shoppers can get this free" under the price (single
  variant), in the variant dialog and in the variants table, for visible ₹0 variants.
- Store health `products_no_price` now ignores hidden variants and links to the new
  `?missing=price` products filter (Missing → "Price (₹0 on store)").

## Migration order

0184 is left for Rollouts R1b (#944). Whichever merges second regenerates its journal entry
so the tags stay in number order and each `when` is later than the one before it: Drizzle
skips an entry whose `when` is older than the last migration a database already applied.

## Not verified

- DB-backed tests (cart, place order, theme import hidden variants) were written but not run:
  Docker's Postgres was down during this work.

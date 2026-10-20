# Pre-order product cards, and the store's price format

Branch `fix/waimers-preorder-cards-money-format`. Migration `0141_store_money_format` (adds
nullable `store.money_format`).

## Pre-order on product cards

- Cards (collection, search, wishlist, related, predictive search) said "Sold out" for products
  on pre-order. `CardProduct` gains `preorder: { buttonLabel } | null`, set by `cardPreorder` in
  `apps/storefront/src/lib/catalog.ts` with the product page's own rule (`purchasableFor`, now
  module-level and shared): no stock left, launched, and a variant still sells through the
  product's or variant's pre-order switch (which the Shopify import sets from "continue selling
  when out of stock" or a pre-order selling plan), within the pre-order limit.
- `listCardProducts` and `listCollectionProducts` select the pre-order columns and
  `variant.preorder_override` for it.
- `ProductCard` shows a "Pre-order" badge (`product-card__badge--preorder`, styled like
  "Coming soon") and Quick add reads the product's pre-order button label and stays
  purchasable. Predictive search no longer marks those products "Sold out".

## Store price format

- `@commerce/money` owns Shopify-style formats now: `formatWithMoneyFormat` (moved from
  theme-import `shopifyMoney`, still exported there under that name), `formatStoreMoney`
  (format or ₹ default), `isMoneyFormat`, `cleanMoneyFormat` (Shopify's HTML format to text).
- Setting: Settings › Store details › Currency and time › "Price format" (en + hi). Blank keeps
  ₹6,499; e.g. `Rs. {{amount}}` shows `Rs. 6,499.00`. Saved through `store.updateGeneral`
  (`moneyFormat`, optional so older callers keep the saved value).
- Shopify import, Store settings step: reads `shop.currencyFormats.moneyFormat` and plans a
  `money_format` line (update / matches); applied through `saveStoreProfile`.
- Storefront: the layout wraps the page in `MoneyFormatProvider` (both the React and the
  Liquid layout); `Price`, buy buttons (deposit), payment signals, EMI block, predictive search
  and the price filter read it with `useFormatPaise()`. `Price` is now a client component.
  Liquid renders pass the store's format to `| money` and `shop.money_format`
  (`liquid-theme.ts`, cached per store version).
- Display only: amounts stay integer paise. Cart, checkout, account, emails and invoices keep
  the currency format for now.

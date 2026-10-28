# Markets M1c: our themes, cart and checkout show the market's currency

On a market in another currency (`/ae`, `/en-us`, a market domain) our own theme's prices, the
cart page, the cart drawer and the checkout summary read in that currency. Pay still charges
rupees until M2, and the checkout says so. Imported themes were M1b.

## How
- **Conversion moved into `@commerce/money`:** `MarketPricing`, `RUPEE_PRICING`,
  `presentmentMinor`, `presentmentCents` and the new `formatPresentment(paise, pricing)` live
  there now, so `@commerce/blocks` (which does not depend on core) prices with them. Core's
  `markets/presentment.ts` re-exports them and keeps `marketPricing`.
- **Blocks:** `MarketPricingContext` next to `MoneyFormatContext`; `useFormatPaise()` formats in
  the market's currency when there is one, else the store's own format. `MoneyFormatProvider`
  takes `pricing`. New `useMarketPricing()` and a client `<Money paise>` for server components.
- **Storefront layout:** both `MoneyFormatProvider`s get `requestMarketPricing(storeId)`.
- **Cart:** `cart-contents` (server, `<Money>`), `cart-lines`, `cart-drawer` and
  `free-shipping-progress` (now a client component) use `useFormatPaise`.
- **Checkout:** the summary (lines, subtotal, discount, shipping, adjustment, GST line, total,
  gift card rows, due today/later) and the shipping options use the market formatter. Under
  the summary, on a market: "You'll be charged ₹2,150 (about AED 94.50). Your bank converts it
  at its own rate." (`content.chargedInRupees`, owner's choice on 28 Oct).

## Stays in rupees on purpose
- The Pay button and the Express checkout line: what is charged.
- Gift card balances, the thank-you page, order details, the pay page, balance and invoice
  pages, account order history, affiliate pages, the Inbox chat: amounts of a placed order or
  of rupee instruments.
- Price filter ranges on collection and search pages (still a follow-up).

Tests: blocks `test/market-prices.test.tsx` (price blocks and `<Money>` in USD under a market,
the store's format without one) and the full blocks suite (689); money (31,
`formatPresentment`); core markets (32); storefront `src/components` + `src/lib` (324); sweeps
26/26; component checker 0 errors; typecheck money, blocks, core, storefront.

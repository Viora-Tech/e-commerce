# Markets M1b: imported themes show the market's currency

A store on an imported Shopify theme (Waimers) shows prices in the page's market currency:
`/ae` in dirhams, `/en-us` in dollars, at the market's fixed or daily reference rate, with its
adjustment and rounding (M1a, `presentmentMinor`). Checkout still charges rupees (M2).

## Where prices change
- **Amounts in hundredths, as Shopify's are:** `presentmentCents(paise, pricing)` (core
  `markets/presentment.ts`) is the converted price ×100 in the market's currency, also for
  dinars and yen, so a theme's `| money` and its scripts keep dividing by 100.
- **Products and variants:** `loadProducts`, `productsByHandles` and `collectionsProducts` take
  the pricing (`storeLiquidData` options `pricing`); `price` and `compare_at_price` come out
  converted everywhere the theme reads them (sections, product JSON, recommendations, search).
- **Shop and money:** `shop.currency`, `shop.enabled_currencies`, `cart.currency` and the
  runtime currency are the market's. A market currency formats with `moneyFormatOf(currency)`
  (`@commerce/money`: `${{amount}}`, `AED {{amount}}`, `¥{{amount_no_decimals}}`) instead of the
  store's rupee format; the store's own format stays for rupees.
- **Cart:** the Liquid cart (`lib/liquid-cart.ts`, moved out of `liquid-theme.ts`) and the
  theme's `/cart.js` total (`theme-actions/cart` route) are converted.

## Per request
- `lib/market-pricing.ts`: `marketPricingFor(storeId, marketId)` reads every market's pricing once
  per store version and UTC day (`storeMarketPricing`); null for rupees or a market with no
  rate yet. `requestMarketPricing`, `requestPriceCents`, `pricingKey`.
- Caches: the Liquid render cache key and the cross-request theme data cache
  (`cachedLiquidData`) both add the market's currency, rate, adjustment and rounding, so a
  subfolder market (same origin as India) never reads India's cached prices, and a new day's
  rate gets fresh pages.

## Not yet
- Price filter ranges on collection and search pages are still in rupees.
- Our own theme's blocks, the cart drawer and the checkout (M1c).
- Charging in the market currency (M2).

Tests: core `theme-import/market-prices.test.ts` (variant and compare-at prices, shop
currency, rupees without a market, hundredths for KWD/JPY), core theme-import + markets (176),
money (30, `moneyFormatOf`), storefront `src/lib` (286), sweeps 26/26; typecheck core, money,
storefront.

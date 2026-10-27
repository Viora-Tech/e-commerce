# Markets in the storefront proxy (country, currency and language routing)

Builds on migration 0177 (`2026-10-28-schema-integrity-markets.md`). The storefront now serves
every market a store sets up, Medusa / Shopify Markets style. A store with only its India market
behaves exactly as before: same URLs, same pages, same cache keys.

## How a request finds its market (`apps/storefront/src/lib/markets.ts`)

Order: URL prefix → a market's own domain → the shopper's saved choice → the primary market.
The visitor's IP country (`cf-ipcountry`) never switches the market by itself, so crawlers
index the right prices.

- Prefixes: `/ae` (a subfolder market in its own language), `/ar-ae` (another language of it),
  `/en-us` (a subfolder written with its language), `/hi` (another language of the host's own
  market). Only two-letter segments, which never clash with a storefront route.
- The prefix comes off the path before routing. `x-pathname` and the rendered routes see
  `/products/x`; the proxy rewrites `/ae/products/x` like `/products/x`.
- Saved choice: the `wc_market` cookie holds a country, plus the language when it is not the
  market's own (`AE`, `AE:ar`). A prefixed visit saves it; the theme's selector saves it. It is
  a `wc_*` cookie, so the edge cache already treats those visitors as personal.
- Redirects, browse pages only (home, products, collections, pages, blogs, search, cart,
  policies):
  - 301 to the one way to write a prefix (`/AE` and `/en-ae` → `/ae`); a subfolder market seen
    on a market domain → the primary host.
  - 302 `private, no-store` to the saved market's own URL (subfolder or domain), on page loads
    only (`Sec-Fetch-Dest: document`), never for RSC fetches or crawlers.
- Headers for the app (derived, stripped from the client): `x-market-id`, `-currency`,
  `-locale`, `-country`, `-prefix`, `-countries` (every country the store sells to) and
  `-languages` (`en=/ae,ar=/ar-ae`).
- Checkout keeps its frame isolation on prefixed paths (`/ae/checkout`).
- A store whose market lookup fails (a database blip, or a storefront deployed before 0177)
  serves the primary market.

## Imported (Shopify) themes

- `localization` lists every country of every enabled market and the market's languages, each
  with its root URL. `localization.country`, `.language` and `.market` follow the page.
  `request.locale`, `shop.locale` and `shop.published_locales` follow too, and `routes` sit
  under the prefix (`/ae/cart`). Core: `packages/core/src/theme-import/localization.ts`.
- The theme's selector (`{% form 'localization' %}` → `/theme-actions/localization`) saves the
  choice and returns 303 to the same page in the new market and language
  (`lib/market-switch.ts`, `switchMarket`). `return_to` must be a path on this site.
- The Liquid render cache keys by market, language, country and prefix
  (`lib/liquid-market.ts`). The key is unchanged for a store selling in one country and one
  language.
- The theme-import report now says the selector lists your markets (English and Hindi).

`<html lang>` follows the market language on both our own theme and imported themes.

## Not yet (next PRs)

- Prices in the market currency. Prices and the selector still show the store currency (INR)
  until the exchange-rate job and presentment money are built (`exchange_rate`, `*_minor`
  columns from 0177). Checkout still charges INR.
- Translations: the theme's `t` filter still uses its default locale file.
- Links in our own theme are not prefixed. The saved-choice redirect keeps shoppers in their
  market.
- hreflang alternates and sitemap entries per market.
- A "shop in your country" suggestion from the IP country. It should be a small endpoint the
  page fetches, so pages stay cacheable.
- Settings → Markets in the admin (separate PR).

## Ops

A market's own domain must be a store domain that serves the store, not one set to redirect to
the primary.

## Tests

- `apps/storefront/src/lib/markets.test.ts`: pick order, prefixes, domains, saved choice,
  redirects, the selector, header hand-off.
- `packages/core/src/theme-import/localization.test.ts`: Dawn-style selector rendering with and
  without a market.

# Market suggestion banner (2026-10-31)

"Shopping from United Arab Emirates? See prices in AED" with **Stay in INR** / **Shop in AED**:
a small card offering the market of the visitor's country when the page shows another one. It
follows Shopify's guidance for custom storefronts: the IP country only suggests, the store
never redirects by it (crawlers come from the US without cookies, cached pages ignore geo).

## How it decides, without breaking caching

- Pages stay CDN-cacheable for visitors without our cookies (`lib/edge-cache.ts`), so nothing
  visitor-specific goes in the HTML. The layout only renders `<MarketSuggestion />` (a client
  component) when the setting is on, there is no theme preview, and the store has more than
  one enabled market. That is the same for every visitor, so it is cache safe.
- After load the component asks `GET /theme-actions/market-suggestion?path=<pathname>`. Theme
  actions are never shared pages, and the answer says `cache-control: private, no-store`. The
  route reads the `x-visitor-country` header the proxy forwards from Cloudflare's
  `cf-ipcountry`, the `wc_market` cookie (httpOnly, so it can only be read server side) and the
  User-Agent, and answers `marketSuggestion()` (`apps/storefront/src/lib/market-suggestion.ts`, pure,
  tested in `market-suggestion.test.ts`). It returns null for: a saved `wc_market`, no or invalid
  country, bots (`isBotUserAgent`), checkout/account paths (with or without a market prefix),
  fewer than two live markets, a country no live market sells to, or the page already showing
  the visitor's market.
- **Shop in** posts the existing country selector form (`/theme-actions/localization`, i.e.
  `switchMarket`): it saves the choice and returns 303 to the same page in the new market.
  **Stay** (and the close button) posts the same action with the current market's country and
  language using `fetch(..., { redirect: 'manual' })`. Only the saved cookie matters there, and
  the card hides at once.
- The client also skips frames (`window.self !== window.top`, so not in the theme editor or
  thumbnails) and hides on checkout/account after a client-side navigation.

## Setting

`store.preferences.markets.suggestMarket` (default true). There is no migration: it uses the
existing JSON column and saves only its own key (`packages/core/src/markets/settings.ts`). API:
`markets.settings` (Settings: read) and `markets.saveSettings` (Settings: manage); the MCP action
docs were updated by hand. Admin: a **Visitors from other countries** card under the Markets
list (`components/markets/market-suggestion-card.tsx`), copy in `data/markets.ts` and
`data/hi/markets.ts`. Storefront copy: `apps/storefront/src/data/markets.ts`.

## Themes

The card mounts in the store layout next to `ConsentManager` in both branches, so it shows on
our themes and on imported Liquid themes. It uses the same Tailwind tokens and `.btn` classes
as the cookie banner. It sits top-right on desktop and full width at the top on phones (the
cookie banner is bottom-left).

## Known limits

- A visitor who lands on a market's prefix URL (`/ae/...`) gets `wc_market` saved by the proxy
  on that first response (existing behaviour), so they are treated as having chosen and see no
  card. Visitors on the primary domain, or on a market's own domain, do see it. Changing this
  would need a separate "explicit choice" cookie.
- `cf-ipcountry` only arrives once traffic goes through Cloudflare. Without it, nothing shows.

## Testing locally

- Outside production the route accepts `?country=XX`, and the component forwards a page's
  `?visitor_country=XX`. Example: open `http://<store-host>:<port>/?visitor_country=AE` in a
  private window (no `wc_market`), with an enabled market that contains AE.
- Another option is to send `cf-ipcountry: AE` with a header extension (ModHeader) and let the
  proxy forward it.
- curl needs a browser User-Agent (curl's own is treated as a bot):
  `curl -H 'cf-ipcountry: AE' -A 'Mozilla/5.0' 'http://<host>/theme-actions/market-suggestion?path=/'`
- Unit test: `bunx vitest run src/lib/market-suggestion.test.ts` in `apps/storefront`.

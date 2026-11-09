# Plain HTML pages: our cookie banner and the market suggestion as islands (9 Nov 2026)

Phase 2 of `docs/design/storefront-plain-html.md`. Builds on the island modules of the tracking
islands PR.

- **Our cookie banner** for an imported theme without its own (`banner-modules.ts`, `consent`,
  5.4 KB raw / 2.0 KB gzip): the same choices and copy as `CookieBanner` (equal "Necessary only"
  and "Accept all", optional boxes unticked; ticked as chosen when reopened). Loaded at once while
  the shopper has no answer for the current banner version, or when `#cookie-settings` is opened.
  It answers with the same `commerce:consent` event a theme's banner sends, so the inline island
  stores the cookie, posts the proof (`/theme-actions/consent`) and loads what was allowed. The
  "ask or not" decision is made in the browser from the cookie, so the page stays the same for
  every visitor (edge-cacheable). `no-theme-cookie-banner` is no longer a skip reason.
- **Market suggestion** (`market`, 5.8 KB raw / 2.3 KB gzip): with Preferences › Markets ›
  suggest on and more than one market live, asks `/theme-actions/market-suggestion` after load
  and draws "Shopping from …? Shop in …" under the header, "Shop in" posting the country
  selector's form, "Stay" saving the market shown, as `MarketSuggestion`. `market-banner` is no
  longer a skip reason. Subfolder markets (`/ae/...`) still take the React page (proxy).
- Both cards carry a small scoped stylesheet with `Canvas`/`CanvasText` fallbacks: the plain page
  has only the theme's CSS.

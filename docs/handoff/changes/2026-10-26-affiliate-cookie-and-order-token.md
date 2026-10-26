# Affiliate referral cookie without consent; order token out of the URL

Branch `feat/privacy-2026-10-26b`. No migration. Both owner-approved.

## 1. Affiliate links credit the affiliate whatever the consent banner says

- The proxy (`apps/storefront/src/proxy.ts` → `lib/referral-landing.ts`) handles a `?ref=<code>`
  landing: it sets `wc_ref` = `<code>.<unix seconds>` (httpOnly, SameSite=Lax, Secure on https,
  path `/`, max-age = the store's **Link counts for** days), only while the store has the
  Affiliates app (settings cached 30 s per process). Nothing about the shopper is stored.
- The click count moved from `/api/beacon` (consent-gated) to the proxy: it bumps the
  affiliate's `clicks` and `affiliate_click_day` (affiliate id + day + count). Bots, link
  previews (`isBotUserAgent`), prefetches and non-GET requests are skipped; the same code again
  within 30 minutes is not counted twice (`lib/referral-click.ts`, pure).
- `readAttribution` (`lib/attribution-cookie.ts`), used when a cart is created and at checkout,
  now returns `withReferral(wc_attr, wc_ref)` (`packages/core/src/marketing/attribution.ts`): a
  later non-direct analytics touch keeps its place (last click), otherwise the referral becomes
  `{ channel: 'affiliate', ref, at }`. `matchAffiliate` already checks `at` against the window.
- A `?ref=` landing is never edge-cached (`personal`), and `wc_ref` does not stop later pages
  being edge-cached (`NEUTRAL_COOKIES` in `lib/edge-cache.ts`).
- Saying no to analytics does not delete `wc_ref` (it is functional). Copy updated: the
  banner's Necessary category (storefront and Zero Drift block), the privacy-policy template's
  Cookies paragraph (new policies only; already published policies keep their text), the
  admin's Link-window help (en + hi), the affiliate dashboard hint, merchant guide and the
  developer customer-privacy page.

## 2. Order view token never sits in the address bar

- `/checkout/thank-you/<n>?t=` and `/checkout/pay/<n>?t=`: the proxy answers a GET/HEAD with a
  302 to the same URL without `t` (other params kept) and sets `wc_ov` (the token, httpOnly,
  Secure on https, SameSite=Lax, path = that page, 30 min). The redirect has no body, so no
  pixel or tag ever runs while `t` is in the URL. Pure logic: `lib/order-token-swap.ts`.
- The pages read the token with `orderPageToken` (`lib/order-view-cookie.ts`): `?t=` if still
  present, else the cookie.
- Server actions that land on these pages (checkout, retry payment, pay balance, invoice pay,
  track order) use `redirectToOrderPage(href)`, which sets the cookie and redirects to the clean
  URL itself: an action's redirect is rendered in the same response, so the proxy would never
  see the `?t=`. Old `?t=` links (emails, chat "View order", COD confirm, gateway returns) keep
  working through the proxy swap.
- Path-token pages (`/checkout/balance/<token>`, `/checkout/invoice/<token>`, `/cod/<token>`)
  were already excluded from tags by `lib/tracking-paths.ts`; unchanged.
- Behaviour change: reloading a clean thank-you URL more than 30 minutes later shows 404 unless
  the shopper is signed in as the owner; the original link still works.

Tests: `packages/core/src/marketing/attribution.test.ts` (referral codec, `withReferral`),
`apps/storefront/src/lib/{referral-click,order-token-swap,order-token-proxy,edge-cache}.test.ts`,
DB-backed `packages/plugin-affiliates/test/referral-cookie.test.ts` (declined-consent order
credited via `wc_ref`, window expiry, last click).

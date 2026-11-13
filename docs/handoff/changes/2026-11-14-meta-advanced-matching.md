# Meta manual advanced matching, and why server Purchases were skipped as `no_tracking`

Tracking stays opt-in: nothing below runs, and no pixel is initialised, before a yes to
marketing on the current banner (browser and server alike).

## Manual advanced matching (browser pixel)

- `packages/core/src/pixels/match.ts` (new, pure): Meta's normalising rules (email, phone with
  country code, first/last name, city, state, PIN, country, external id), moved out of `hash.ts`
  so the browser and the server normalise the same way. `hash.ts` now hashes
  `normaliseCustomerFacts`; it also gained `hashMatchValues` (one hex string per key).
- `GET /api/px/me` (new): after the same consent and app checks as `/api/px`, returns the
  shopper's match values **hashed on the server** (SHA-256): cart checkout contact first, then the
  signed-in customer and their latest address, external id = customer id or visitor id.
  Without consent or the app: 204 and no customer data is read. `private, no-store`.
- `PixelEvents` (React) and the plain HTML pixels module now initialise each pixel themselves:
  `fbq('init', id, hashedMatch)` before the first event (waits at most 1.5 s for `/api/px/me`).
  `fbqInit` emits only the fbevents.js loader for Pixels-app pixels (the legacy single pixel is
  unchanged).
- Checkout: `useCheckoutMatch` reports the contact and address as typed; the listener (only
  mounted after a yes) hashes them with Web Crypto and re-inits the pixels when they change. The
  default state is ignored until a PIN code is in. The old plain `em`/`ph` passed on
  AddPaymentInfo (`CommerceTrackDetail.match`) is removed: no readable value reaches fbevents.js.

## Server events

- Purchase: `user_data` now also carries the address country (was always `in`); state and PIN
  are sent only for India.
- Storefront events (InitiateCheckout, AddPaymentInfo, AddToCart): also the cart's name and
  country, besides email, phone and external id.

## `no_tracking` (order #2418 and the low server event rate)

`purchaseSkipReason` returns `no_tracking` when `order.tracking` is null. The order copies
`cart.tracking`, and only `/api/px` ever stamped it, so:

1. Every order from a shopper without marketing consent was logged as `no_tracking`
   ("No browser details") instead of `no_consent`.
2. A shopper who did say yes but whose beacon never reached `/api/px` after the cart existed
   (blocker on `/api/px`, yes given late) also lost the server Purchase.

Fix: `checkoutAction` now calls `syncCartMarketingConsent` (`pixels/collect.ts`) instead of
`withdrawCartMarketingConsent`. A yes now records the consent plus `_fbp`/`_fbc` cookies, IP and
user agent from the checkout request (earlier collector values kept). No yes withdraws a yes and,
on a cart with no tracking, records only the no (no browser details), so the skip reads
`no_consent`.

3. Imported-theme banner: the theme's "answered recently" localStorage stamp
   (`glide:cookie-consent:sections--…__cookie-banner`, 180 days) was trusted by our early-reveal
   script. Waimers ran the same theme on Shopify on the same domain, so shoppers who answered the
   Shopify banner were **never asked** on Koomerce, had no `wc_consent`, and no marketing event or
   server Purchase was ever sent for them (likewise after a banner version bump). The reveal
   script (`lib/liquid-consent-reveal.ts`) now shows the banner whenever our cookie holds no
   answer and removes the stale stamp. Cached section HTML picks this up when the store version
   changes or the render cache expires.

Not changed: orders placed outside the storefront checkout (admin, imports) still log
`no_tracking`, correctly.

## Tests

`hash.test.ts` (normalising, shared browser/server values, `browserMatchData`),
`engine.test.ts` (full Purchase `user_data` shape), `storefront-events.test.ts`
(`syncCartMarketingConsent`, `shopperMatchFacts`), `api/px/me/route.test.ts` (consent gate,
hashed only), `lib/pixels/match.test.ts`, `use-checkout-match.test.ts`, `track.test.ts`,
`pixels-module.test.ts`, `liquid-consent-reveal.test.ts`.

To verify on the live store: Meta Pixel Helper should show the first `init` with hashed
`em`/`ph` for a signed-in shopper, and Events Manager's match quality for Purchase should rise.
Meta's docs do not spell out a second `init` for the same pixel; the checkout re-init is
best-effort (the server events carry the same data regardless).

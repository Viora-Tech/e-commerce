# Pixels app, PR 4 of 5: storefront events and the first-party collector

Browser half of the Pixels app. Design: `docs/superpowers/specs/2026-10-24-pixels-design.md` §4.

- Events: blocks and pages fire `commerce:track` through `trackCommerce()` (`@commerce/blocks`,
  `store-actions.ts`), queued on `window` so an event fired before the listener mounts is not lost.
  PageView on every navigation, ViewContent on the product page, AddToCart after `onAddToCart`
  (`product-buy-buttons.tsx`), InitiateCheckout when checkout opens (`ic_<cartId>`), Purchase on the
  thank-you page (`ord_<orderId>`). AddToCart ids are `atc_<variantId>_<n>` (n counts adds per tab).
- `components/analytics/pixel-events.tsx` (mounted by the consent manager only with marketing consent)
  and `lib/pixels/track.ts`: `fbq('trackSingle', pixel, name, data, { eventID })` for each pixel with
  the event on (Purchase only for "placed" pixels), plus `sendBeacon('/api/px')`. Calls before
  fbevents.js loads wait in a small queue. Nothing fires on sign-in pages.
- `tracking-tags.tsx` takes `pixels` and runs `fbq('init')` for each. With the Pixels app installed the
  storefront reads `pixel_connection` (cached per store; the table now has the cache trigger) and no
  longer the old `preferences.tracking.metaPixel`; stores without the app keep the old PageView pixel.
- `/api/px` (`app/api/px/route.ts`, core `pixels/collect.ts`): same origin, 4 KB cap, rate-limited,
  only our five event names and id shapes. Needs the app and marketing consent on the current banner
  version, else 204 with nothing kept. Reads or mints `_fbp`, makes `_fbc` from `fbclid` (390-day
  first-party cookies), stamps `cart.tracking` (fbp, fbc, IP, UA, page, consent), queues one
  `{pixels}-send` job per pixel with a token and the event on. Never queues Purchase (the order job
  does). Values come from the cart or catalogue in the sender.
- Consent: the marketing line now names "advertising partners such as Meta"; migration bumps every
  store's banner version so returning shoppers are asked again.

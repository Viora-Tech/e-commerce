# Gift card import, returns fixes, Pixels fixes

Branch `feat/imports-2026-10-26`. No migration.

## Shopify import marks gift cards

- `packages/plugin-shopify-import/src/gift-card-products.ts`: `giftCardFrom` reads Shopify's
  signal (Admin API `isGiftCard`, the CSV "Gift Card" column, else product type "Gift Card" or
  the `gift_card` template); `asGiftCardVariants` makes the variants untracked, untaxed and
  weightless, the way `createGiftCardProduct` does.
- The API queries (paged and bulk) now ask for `isGiftCard`; the CSV parser reads the column
  (a blank cell says nothing). `write-products.ts` sets `product.isGiftCard` after each create
  or update, so a re-import turns it on or off with Shopify. A CSV that does not say leaves it.
- Tests: `test/gift-card-products.test.ts`.

## Returns

- RTO of one parcel (`returns/rto.ts`): the task now holds only that parcel's units (from its
  fulfilment order), not everything shipped on the order, so restocking no longer inflates
  stock for split orders. Shipments without a parcel keep the old behaviour.
- RTO refund suggestion and store credit cap (`returns/resolve.ts`): the whole amount paid only
  when the RTO covers every shipped unit; one parcel of several suggests that parcel's goods.
- Late courier pickup (`returns/notify.ts` `announceLatePickup`): booking a courier after the
  approval message went out (merchant chose "later", or auto-approve) sends the approval again
  with the courier and tracking number. Booked in the same step, still one message.
- Tests: `returns/returns-flow.test.ts`.
- Not done: an exchange (`exchangeReturn`) sends the shopper no message; there is no template
  for it yet.

## Pixels

- Page URLs (`pixels/client.ts` `pixelPageUrl`, used by `parsePixelBeacon`): Meta's
  `event_source_url` and the order's landing URL keep only `utm_*`, click ids and `variant`;
  the thank-you page's `?t=` order token, `?email=`, search text and fragments are dropped.
- Token pages (`storefront/src/lib/tracking-paths.ts`): no third-party tags or pixel events on
  `/checkout/balance|invoice|recover/<token>`, `/cod/<token>`, `/newsletter/confirm/<token>`,
  `/unsubscribe/<token>`.
- AddToCart value: the beacon carries the added quantity (a count, never a price); the server
  copy is worth the units just added, matching the browser copy, not the whole cart line.
- Consent at checkout (`collect.ts` `withdrawCartMarketingConsent`, called from
  `checkoutAction`): a marketing yes taken back before paying turns the cart's (and so the
  order's) consent off, so no server Purchase goes.
- Tests: `pixels/storefront-events.test.ts`, `storefront/src/lib/pixels/track.test.ts`,
  `tracking-paths.test.ts`.
- Open: the thank-you and pay pages still carry `?t=<order view token>` in the address bar, and
  fbevents.js / gtag send `location.href` themselves. Fix needs the token moved out of the URL
  (e.g. the proxy swapping it for a short-lived cookie). AddPaymentInfo is not an event the
  Pixels app has (design lists five).

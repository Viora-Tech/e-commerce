# Courier caches keyed by credentials, not just the account name (12 Nov 2026)

Branch `fix/courier-cache-keys`.

- DTDC (`packages/shipping-dtdc/src/dtdc.ts`): the tracking token was cached by tracking
  username only, so two stores with the same username, or a store after changing its password,
  shared a live token. The key is now a SHA-256 of tracking URL + username + password, the same
  pattern FedEx uses (`packages/shipping-fedex/src/fedex.ts`). The raw secret is never in a key.
- Blue Dart (`packages/shipping-bluedart/src/gateway.ts`): the gateway JWT was cached by base
  URL + Client ID; the key is now a SHA-256 of base URL + Client ID + client secret. The licence
  key is not part of the token (it is sent per request in `Profile`), so it stays out of the key.
- Storefront PIN code check (`apps/storefront/src/lib/shipping.ts`, 24 h cache): the key from
  `serviceabilityKey` in `packages/queue/src/cache.ts` now carries a 16-character hash of the
  courier app's saved settings, so saving new credentials or options is a cache miss instead of
  a day of old answers. Old keys simply expire.
- Checkout delivery quotes (`packages/core/src/shipping/delivery-options/quotes.ts`, fresh 6 h,
  kept 7 days): `deliveryQuoteKey` (now `v3`) carries the same hash. `gatherProviderAnswers`
  takes `providerSettings` (the store's `ShippingSettings.providers`), and `quoteDelivery` /
  `quoteParcelDeliveries` require it; the storefront checkout, order placement and the admin
  "Try a PIN" pass `settings.providers`. After deploy every app/PIN starts cold once (first
  shopper per PIN waits up to the 2.5 s cold deadline).
- The hash is `courierSettingsFingerprint` in `packages/core/src/shipping/courier-fingerprint.ts`
  (subpath `@commerce/core/courier-fingerprint`), over the settings as stored (secrets still
  encrypted), so any save of that courier's settings resets its cache.
- Tests: `packages/shipping-dtdc/test/dtdc.test.ts`, `packages/shipping-bluedart/test/bluedart.test.ts`,
  `packages/queue/src/cache.test.ts`, `packages/core/src/shipping/delivery-options/quotes.test.ts`.

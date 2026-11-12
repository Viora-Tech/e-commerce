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
  courier app's saved settings (`courierSettingsFingerprint`), so saving new credentials or
  options is a cache miss instead of a day of old answers. Old keys simply expire.
- Tests: `packages/shipping-dtdc/test/dtdc.test.ts`, `packages/shipping-bluedart/test/bluedart.test.ts`,
  `packages/queue/src/cache.test.ts`.

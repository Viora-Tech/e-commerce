# Recommended way to pay: enabled methods only, None, no badge when unavailable

Fixes #1173 (follow-up to #1199, which first added the choice).

- Settings → Checkout → Recommended way to pay now lists Automatic, the ways to pay switched on in
  Settings → Payments (`CheckoutSettingsView.paymentMethods`, switched-off gateways left out),
  and None. A saved choice that has since been switched off still shows, marked "(switched off)".
- Stored on `store.preferences.checkout.recommendedMethod` as before (no migration).
  `RECOMMENDED_METHOD` in `@commerce/core/checkout-settings`: `''` automatic (default, the old
  behaviour: first way to pay, never cash on delivery), `'none'` no badge.
- Storefront `recommendedMethodId(methods, chosen, codBlocked)`: a chosen way to pay that is not
  on offer for this cart, or cash on delivery when it is blocked for the order (PIN code, order
  limit, Express), now shows no badge instead of falling back to the first one.
- Copy moved to `checkoutRecommendedContent` with a Hindi overlay. Save stays `SETTINGS_MANAGE`.
- Tests: storefront rule (chosen, unavailable, none, default), core schema, and
  `packages/api/test/checkout-recommended.test.ts` (save keeps other preferences, enabled list).

# Snapmint availability check moves to Visibility V2

**What:** `SnapmintProvider.checkAvailability` now calls Snapmint's Visibility V2,
`POST /ext/v1/visibility` on `https://apis.sandbox.snapmint.com` (sandbox) or
`https://apis.snapmint.com` (live), instead of the old `POST /v1/merchants/orders/check_visibility`
on the API host.
- Auth: `Authorization: Basic base64(merchantId:merchantKey)`. V2 calls the secret
  "merchantSecret"; our config has merchant ID, key and token, and the token stays the Bearer for
  order status and refunds, so the key is taken as the secret. If Snapmint answers 401 with the
  key, try the token here (`snapmintBasicAuth` in `http.ts`).
- Headers: `x-forwarded-for` with the shopper's IP when we have one (loopback in local
  development, as for carts). The storefront action (`lender-visibility-actions.ts`) now passes
  the IP it already worked out.
- Body: `mobile` (10 digits, as text), `firstName` (a middle name stays here), `lastName`,
  `orderValue` (rupees, still capped at ₹10,000), `shippingAddress` and `billingAddress` (same
  address; checkout asks before a separate billing address exists), `payload: {}`. Addresses are
  left out when checkout has none yet.
- Answer: a bare `true`/`false`, or one under `visible`/`eligible`/`isEligible`/`is_eligible`/
  `visibility`/`result`, at the top or under `data`. Anything else shows Snapmint.

**Files:** `packages/payments-snapmint/src/visibility.ts` (new: body builder and answer reader),
`src/http.ts` (`ext` host, `auth: 'basic'`, extra headers), `src/snapmint.ts`,
`apps/storefront/src/lib/lender-visibility-actions.ts`.

**Still fail open:** Snapmint must allow-list our server IPs for V2, which is not done yet. Until
then the call is refused; a 403, any other error, a 1.5 s timeout or an unknown answer all show
Snapmint, so checkout behaves as before. Once allow-listed, check one real answer's shape against
`readSnapmintVisibility`.

**Tests:** `packages/payments-snapmint` 41/41 (new `test/visibility.test.ts`).

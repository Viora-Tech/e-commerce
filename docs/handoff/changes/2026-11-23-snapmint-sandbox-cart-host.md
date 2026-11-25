# Snapmint sandbox: carts go to apis.sandbox.snapmint.com

**What:** In sandbox mode, the create-checkout call (`POST /api/pub/carts`) now goes to
`https://apis.sandbox.snapmint.com` instead of `https://pay.sandbox.snapmint.com`. Live is unchanged
(`https://pay.snapmint.com`). File: `packages/payments-snapmint/src/http.ts`.

**Why:** Snapmint confirmed on 23 Nov 2026 that carts need no IP allow-listing. From our office IP,
`pay.sandbox.snapmint.com` answered every request (even `GET /`) with a CloudFront "Request blocked"
403. `apis.sandbox.snapmint.com` serves the same carts endpoint and created a sandbox cart.

**Found while testing (local only, no code change):**
- Snapmint's firewall refuses a cart whose return URLs contain `http://localhost` or `127.0.0.1`
  (CloudFront 403). Locally set `STOREFRONT_URL=http://waimers.localhost:3100`. Live uses the store's
  https domain, so it is not affected.
- The checkout page Snapmint sends the shopper to is still on `pay.sandbox.snapmint.com`, which
  blocks our office IP. Asked Snapmint to open it.

**Tests:** `packages/payments-snapmint` 35/35.

# Checkout sent shoppers to https://0.0.0.0:3100/checkout

Clicking Checkout on a live store (waimers.koomerce.app) landed on `https://0.0.0.0:3100/checkout`.
`/checkout/start` built its same-origin fallback with `new URL(target, request.url)`; behind the
proxy's rewrite `request.url` carries the server's bind address, not the store's domain.

Fix: `lib/redirect.ts` `redirectTo(path)` answers with a relative `Location`, so the browser stays
on whatever host it is on (subdomain, custom domain, checkout origin), the same way
`theme-actions` already did. Used by every route that redirected to one of its own paths:
`checkout/start`, `checkout/recover/[token]`, `c/[token]` (checkout origin entry) and
`api/m/click/[token]` (bad marketing link → home). Absolute targets (branded checkout origin,
signed marketing destination) are unchanged.

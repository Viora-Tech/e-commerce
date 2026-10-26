# Security: isolate checkout & account from theme code (D-01, phase A)

**Branch** `security/checkout-origin-isolation` from `dev`. Starts closing security audit
2026-10-06 **D-01**: imported-theme JavaScript runs on the store's origin, which also serves
`/checkout` and `/account`. A theme script on any other page could frame those pages or hold a
`window` handle to them and read a shopper's order/address or act as the signed-in shopper.

This is the deployable, low-risk **phase A** (the audit's own fallback: "at least send
`Cross-Origin-Opener-Policy`/`frame-ancestors 'none'` on checkout and account pages"). It does
**not** stop a same-origin `fetch()` of those pages — only a separate origin does; that is phase B
below.

## Done (phase A — ship now)

All in `apps/storefront` (`lib/csp.ts`, `proxy.ts`):

- **`isIsolatedStorePath(pathname)`** — true for `/checkout` and everything under it (pay,
  balance, invoice, thank-you) and `/account` and everything under it (incl. sign-in routes).
  Boundary-safe: `/checkouting`, `/accountant`, `/blogs/account` do **not** match.
- For an isolated page the proxy swaps `frame-ancestors 'self' <admin>` for **`frame-ancestors
  'none'`** (nothing may frame checkout/account, not even the store itself or the theme editor —
  the editor previews theme pages, not the live checkout), and adds the isolation headers:
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups` — severs a `window.opener` handle from
    a theme-opened window, **but** keeps the opener for popups the page itself opens, so a
    **payment gateway window can still post its result back**. (Plain `same-origin` would risk
    breaking gateway popups — deliberately not used.)
  - `Cross-Origin-Resource-Policy: same-origin` — no cross-origin embedding/reads of the response.
  - `X-Frame-Options: DENY` — the pre-CSP-3 belt to `frame-ancestors 'none'`.
- Every other storefront page is **unchanged** — still framable by self + the admin editor, no
  COOP — so the theme editor and admin thumbnails keep working.

### Tests
`lib/csp.test.ts` — the path predicate (matches + boundary) and the isolation-header values.
`lib/csp-proxy.test.ts` — a `/checkout` and `/account/orders` response carry `frame-ancestors
'none'` + COOP/CORP/XFO; a normal page (`/products/...`) keeps self+admin and gets none of them.
Lint + `@commerce/storefront` typecheck clean; both suites green locally.

## Not done yet — phase B (planned, NOT in this PR)

The complete D-01 fix is to move checkout + account to their **own origin** (e.g.
`secure.koomerce.app` / `pay.<store>`) that theme JavaScript never runs on, so a theme script
cannot even same-origin `fetch()` them. That is a multi-day change — routing, the cart→checkout
hand-off across origins, cookie scoping, CSRF, and every gateway return URL — and must not be cut
over on launch day. Tracked as its own effort; phase A buys the framing/opener protection now.

Also outstanding from D-01's third clause: **audit which account mutations need a fresh
confirmation** (re-auth on email/password/address change), to be done with phase B.

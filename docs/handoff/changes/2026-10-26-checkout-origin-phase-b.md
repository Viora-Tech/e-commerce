# Security: checkout on its own origin (D-01 phase B) — behind a flag

**Branch** `security/checkout-origin-phase-b` from `dev`. The full fix for audit **D-01**: the
interactive checkout form moves to a branded, theme-free origin so the browser's same-origin
policy — not just response headers (phase A) — stops theme JavaScript reading or riding it. Design:
`docs/superpowers/specs/2026-10-26-checkout-origin-design.md`; plan:
`docs/superpowers/plans/2026-10-26-checkout-origin-phase-b.md`.

**Everything is gated by `CHECKOUT_SUBDOMAIN` and ships OFF.** Blank = exactly today's same-origin
checkout (the instant rollback). Nothing changes for any store until the flag is set, which happens
in a quiet window after the `checkout.*` hosts are provisioned.

## Shipped (tasks 1–6, 8)

- **`checkoutOriginFor`** (`core/domains/origin.ts`) — `https://<CHECKOUT_SUBDOMAIN>.<store primary>`,
  falling back to the store origin when the flag is off, there's no primary, or in dev.
- **Signed hand-off + session tokens** (`core/checkout/handoff.ts`) — one HMAC, two purposes:
  a 2-min one-shot hand-off and a 2-h checkout session; neither verifies as the other.
- **`/checkout/start`** (store origin) mints a hand-off token for the cart (+ signed-in shopper) and
  303s to `checkout.<primary>/c/<token>`, or falls back to same-origin `/checkout`. The cart button
  points here.
- **`/c/[token]`** (checkout origin) verifies the token, **`redeemHandoff`** loads the cart under the
  store's RLS (refusing a foreign-store, empty, or already-ordered cart — single-use), and writes a
  **host-only `wc_checkout` session cookie**, then → `/checkout`.
- **Proxy `checkout.*` branch** — resolves the store from the primary, serves only `/c` and
  `/checkout` pages (else 404), with the phase-A isolation headers.
- **`checkoutContext` / `checkoutCartId`** — checkout-step actions (`checkoutAction`,
  `captureContactAction`, `checkoutGstAction`, `checkoutShippingAction`, discount apply/remove) read
  the cart from the session (checkout origin) or the cookie (store origin). A **no-op when the flag
  is off** (no session ⇒ identical to `readCartId`). The `/checkout` page bounces to `/checkout/start`
  on the store origin when a branded origin applies, so the form never serves where theme code runs.
- **`CHECKOUT_SUBDOMAIN`** config flag + `.env.example` / `deploy/env.production.example`.

## Remaining (follow-ups, not required for the D-01 security goal)

- **Task 7 — gateway return URLs & order emails → the checkout origin.** Deferred: the thank-you /
  pay / balance / invoice pages are already behind unguessable signed order tokens **and** carry the
  phase-A isolation headers (they're under `/checkout/`), so serving them on the store origin is not
  a D-01 exposure. Pointing their URLs at the checkout origin is consistency/polish and touches
  payment-critical return-URL construction, so it's a separate, CI-verified change (a no-op when the
  flag is off, like the rest).
- **Task 9 — DNS + TLS for the `checkout.*` hosts** (ops): wire the ingress to accept `checkout.*`
  and auto-issue Let's Encrypt per host (reuse the auto-https path); custom-domain stores add one
  `checkout` CNAME. Must be done and verified on staging **before** `CHECKOUT_SUBDOMAIN` is set.
- **Account origin (phase B.2):** `/account` isolation is a separate effort (the theme header shows
  logged-in state). Phase-A headers protect `/account` meanwhile.

## Verification

Pure/logic and routing/context units verified locally (origin builder, both tokens + purpose
separation, `checkoutHandoffTarget`, `checkoutHostname`/`routeForCheckoutHost`, `checkoutContext`,
the flag parse). The DB-backed (`redeemHandoff`) and full typecheck/integration run in CI on the PR
(the gate re-enabled in the same push). Local DB and some typechecks were unavailable in the dev
shell (Postgres down / OS memory), so CI is the integration oracle — which is safe here because the
flag ships off.

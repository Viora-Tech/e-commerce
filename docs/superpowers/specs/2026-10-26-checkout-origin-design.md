# Design: checkout on its own origin (D-01 phase B)

**Date:** 2026-10-26. **Author:** Claude (calls below are mine unless marked "owner").
**Status:** design for review — no product code until approved.

## Intent & why

Imported themes run merchant-supplied JavaScript on the **store's origin**, which also serves
`/checkout`. Phase A (shipped) stops framing and window-handle leaks, but a theme script can still
same-origin `fetch('/checkout/...')` and read what the page would show, or ride the shopper's
same-site cookies. The only real fix is to serve checkout from an **origin where theme code never
runs**, so the browser's same-origin policy — not our header hygiene — is the wall. This is the
Shopify model.

**Why now:** launched 2026-10-26; this is the single biggest remaining security gap (audit D-01)
and the thing that caps us below A+. It is a multi-day change and must **not** be cut over on
launch day — it ships behind a flag and is turned on in a quiet window.

## Scope

**Phase B.1 (this design): checkout only.** `/checkout` and everything under it — cart review,
contact/address, delivery, payment, `pay`, `balance`, `invoice`, `thank-you`.

**Phase B.2 (separate, later): the shopper account.** `/account` is deferred because the theme
header shows logged-in state ("Hi, Priya", order links), so moving the session off the store
origin needs a limited cross-origin "is this shopper logged in" signal — a bigger UX design.
Phase A headers already protect `/account` in the meantime.

## Goals

- A theme script on a store origin cannot read, drive, or ride checkout — enforced by the browser
  (cross-origin), not by headers alone.
- The shopper's experience is unchanged: click **Checkout**, fill it in, pay, see the thank-you
  page. No merchant has to configure anything; works for `*.koomerce.app` and custom-domain stores
  alike.
- Instant, config-only rollback.

## Non-goals

- No checkout UI/UX change.
- No per-store **branded** checkout domain in B.1 (see the owner decision below).
- No account isolation in B.1 (that's B.2).

## Anti-goals (these mean failure even if it "works")

- Breaking payment completion or the gateway return trip.
- Breaking the cart → checkout hand-off (an empty checkout).
- Requiring merchants to add DNS or do anything.

## The decided shape (my calls)

### 1. Branded per-store checkout origin: `checkout.<store primary hostname>` (owner decision)
Each store checks out on a `checkout.` subdomain of **its own primary hostname** — a store on
`waimers.com` checks out at `checkout.waimers.com`; a store on `waimers.koomerce.app` at
`checkout.waimers.koomerce.app`. The brand carries through payment.

This still achieves D-01: `checkout.waimers.com` is a **different origin** from `waimers.com`, so a
theme script on the store origin cannot `fetch` or touch checkout — the browser's same-origin
policy blocks it. The two share a *registrable domain* (same **site**), which is fine: checkout
cookies are **host-only** (no `Domain`, like today's `wc_customer`) so they never reach the store
origin, and the checkout route keeps the `Sec-Fetch-Site` check (audit A-07) so a same-site request
from a `waimers.com` theme cannot ride a checkout cookie.

**Store resolution is by hostname** (strip the `checkout.` label → the store's primary hostname →
resolve the store), so the proxy resolves the store the same way it does today; the hand-off token
(below) carries only the **cart and the shopper identity**, not the store id.

**Provisioning (the cost of branding):**
- **Custom-domain stores** (`waimers.com`): the merchant adds a `checkout` CNAME to our ingress (or
  we add it when we manage their DNS), and TLS is issued per host by the existing on-demand
  Let's Encrypt path (`docs/handoff/changes/2026-10-07-auto-https-domains.md`). Until the merchant
  adds it, that store **falls back to same-origin `/checkout`** (phase-A-protected) — so branding is
  best-effort and never blocks checkout.
- **`*.koomerce.app` subdomain stores**: `checkout.<sub>.koomerce.app` is two labels deep, which the
  `*.koomerce.app` wildcard cert does **not** cover, so it needs a per-host Let's Encrypt cert
  (same on-demand path). Provisioned automatically when the store goes live.

### 2. Cart hand-off (mirrors the existing accounts-domain handoff)
The store's **Checkout** button becomes a store-origin route (`POST /checkout/start` or a GET
redirector) that:
1. reads the cart id cookie (`wc_cart`) on the store origin,
2. mints a **short-lived, single-use, purpose-prefixed signed token** (`sign()` with purpose
   `checkout-handoff`; body = storeId + cartId + expiry; TTL ~2 min),
3. 303-redirects to `https://checkout.<this store's primary hostname>/c/<token>`.

`checkout.<primary>/c/<token>` resolves the store from its own hostname, verifies the token, loads
the cart under that store's RLS, mints a host-only checkout-session cookie binding the browser to
{storeId, cartId}, and redirects to the checkout form. The token is single-use (bound to the cart +
a short TTL; replay is a no-op once the session exists). This reuses the signed-link machinery and
the browser-bound-cookie pattern the accounts domain already uses for OAuth.

### 3. Logged-in shopper at checkout
If the shopper is signed in on the store origin (`wc_customer`), the handoff token also carries a
one-time **identity assertion** (signed, same TTL) so checkout can attach the known customer
without a second login. Not signed in → checkout collects contact details as it does today. (No
store-origin session is ever read cross-origin; identity crosses only inside the signed token.)

### 4. Proxy routing for the checkout host
`proxy.ts` gains a branch for any host whose first label is `checkout` (like the existing
`accountsHostname()` branch): it strips `checkout.`, resolves the store from the remaining
hostname (its primary), serves only the checkout routes and the `/c/<token>` entry, and refuses
everything else with 404. A request for `checkout.<host>` whose stripped host is not a store's
primary is a 404. Checkout responses keep the phase-A isolation headers (`frame-ancestors 'none'`,
COOP/CORP/XFO) — now reinforced by true origin separation. The store origin must also **not** serve
`/checkout` when isolation is on (it only serves `/checkout/start`, the hand-off), so theme code has
nothing local to read.

### 5. Gateway return URLs & emails
Payment init (Razorpay/Cashfree/Decentro) sets its callback/return URL to the store's checkout
origin (`checkout.<primary>/...`). Order-confirmation / balance / invoice emails link there.
Thank-you and pay-balance/invoice pages (already behind signed order-view tokens since A-00) move
to the checkout origin. Every such URL is derived from the store's primary hostname, which the code
already computes (`store.origin` / `storefrontOriginFor`, audit #254) — add a `checkoutOriginFor`
beside it.

### 6. Rollout behind a flag
A new env, **`CHECKOUT_SUBDOMAIN`** (e.g. `checkout`):
- **unset** → today's behaviour exactly (checkout served on the store origin). This is the default
  and the instant rollback.
- **set** → `checkoutOriginFor(store)` = `https://<CHECKOUT_SUBDOMAIN>.<primary>` **when that host
  has a valid cert**; the Checkout button hands off to it, the proxy serves the `checkout.*` host,
  gateways and emails use it. A store whose branded checkout host isn't provisioned yet falls back
  to same-origin `/checkout` (phase-A-protected), so turning the flag on never breaks a store.

Build it off, test on staging (`vioratech.in` → `checkout.vioratech.in`), then set the env in a
quiet window. Unset to roll back with zero code change.

## What's left to the builder

- Exact token format and single-use enforcement (nonce table vs cart-state check) — pick the
  simplest that prevents replay; a DB test for replay + a foreign-store token.
- Whether `/checkout/start` is a server action or a route handler (match the codebase's form
  conventions; it must send no theme layout).
- Cookie names/TTLs on the checkout origin, following `customer-session.ts` conventions.
- TLS/DNS for the per-store `checkout.<primary>` hosts: wire the storefront app's ingress to accept
  `checkout.*` and issue on-demand Let's Encrypt per host (reuse the auto-https path); the merchant
  CNAME step for custom domains (surface it in the admin's domain UI). **owner/infra** for the
  wildcard/ingress rule.
- `checkoutOriginFor(store)` beside `store.origin`/`storefrontOriginFor`, incl. the "is this host
  provisioned / has a cert" check that drives the same-origin fallback.
- Tests: cross-origin handoff happy path, expired/foreign/replayed token, logged-in vs guest,
  gateway return, and a check that a store-origin `fetch` to the checkout host is cross-origin.

## Owner decision — settled

**Checkout domain: branded per-store** (owner, 2026-10-26). Checkout is `checkout.<the store's own
primary hostname>`, keeping the merchant's brand through payment. The cost — per-store `checkout`
CNAME (custom domains) and per-host TLS (`*.koomerce.app` subdomain stores) — is accepted; a store
whose branded host isn't provisioned yet falls back to the phase-A-protected same-origin `/checkout`
so nothing breaks. Reflected throughout §1–§6 above.

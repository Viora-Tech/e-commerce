# Checkout-on-its-own-origin (D-01 phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve each store's checkout from a branded, theme-free origin (`checkout.<store primary>`), so the browser's same-origin policy — not response headers — stops theme JavaScript reading or riding checkout.

**Architecture:** The store origin keeps only a hand-off route (`/checkout/start`) that mints a short-lived, single-use signed token (store + cart + optional customer) and 303-redirects to `checkout.<primary>/c/<token>`. The checkout host resolves the store from its own hostname, redeems the token into a host-only checkout session, and serves the checkout pages. Everything is gated by `CHECKOUT_SUBDOMAIN`; unset = today's same-origin checkout (instant rollback), and any store whose branded host isn't provisioned falls back to same-origin checkout so nothing breaks.

**Tech Stack:** Next.js (storefront app, `proxy.ts` middleware), Bun, `@commerce/core`, `@commerce/config`, Drizzle + Postgres RLS, vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-checkout-origin-design.md`

## Global Constraints

- Component/file conventions: `docs/conventions.md`; `bun run lint` (biome) must pass. Copy in `data/<feature>.ts`; sizes in rem; Tailwind only. (Checkout UI is unchanged here, so little copy work.)
- Next.js is a modified build — read `apps/storefront/node_modules/next/dist/docs/` before new Next API use; `proxy.ts` is the middleware (not `middleware.ts`).
- Never hardcode dynamic values; no `useCallback`/`useMemo`/`React.memo` (React 19 compiler).
- Signed tokens use the existing purpose-prefixed HMAC pattern (`preorder/balance-link.ts`): `createHmac('sha256', secret).update(`${purpose}:${body}`)`, base64url, `timingSafeEqual` compare. Secret is `settingsSecret()` / `SETTINGS_SECRET`.
- Checkout-origin cookies are **host-only** (no `Domain`), `httpOnly`, `sameSite:'lax'`, `secure` in production — exactly `customer-session.ts`.
- Flag: `CHECKOUT_SUBDOMAIN` (string, e.g. `checkout`; unset disables everything). Add to `@commerce/config` env schema as optional; blank = unset.

## Review Focus

- **Flag off must be a perfect no-op.** With `CHECKOUT_SUBDOMAIN` unset, `/checkout` serves on the store origin exactly as today and `/checkout/start` either 404s or redirects to `/checkout`. Test in Task 3 + Task 5.
- **Replayed / stale hand-off token.** A token reused after its cart converted, or after expiry, must not open a fresh checkout for someone else. Test in Task 4 (single-use + expiry).
- **Foreign-store token.** A token minted for store A presented to `checkout.<store B primary>` must be refused (host-derived store must equal the token's store). Test in Task 4.
- **Unprovisioned branded host.** Flag on but `checkout.<primary>` has no cert/route yet → `checkoutOriginFor` returns the same-origin fallback, so checkout still works. Test in Task 1.
- **Same-site cookie ride (A-07).** A `waimers.com` theme POSTing to `checkout.waimers.com` (same site) must still be refused by the `Sec-Fetch-Site` check; the checkout host reuses `isCrossOriginBrowserRequest`. Test in Task 5.

---

### Task 1: `checkoutOrigin` / `checkoutOriginFor` helper

**Files:**
- Modify: `packages/core/src/domains/origin.ts`
- Test: `packages/core/src/domains/origin.test.ts`

**Interfaces:**
- Consumes: existing `storefrontOrigin(primaryHostname, fallback)`, `storefrontOriginFor(tx, storeId, fallback)`.
- Produces:
  - `checkoutOrigin(primaryHostname: string | null, subdomain: string | null, fallback: string): string` — when `subdomain` and `primaryHostname` are both set, returns `https://<subdomain>.<primaryHostname>`; otherwise returns `storefrontOrigin(primaryHostname, fallback)` (the same-origin fallback).
  - `checkoutOriginFor(tx: StoreTx, storeId: string, subdomain: string | null, fallback: string): Promise<string>` — same, resolving the store's live primary hostname the way `storefrontOriginFor` does.

- [ ] **Step 1: Write failing tests** in `origin.test.ts`:
  - `checkoutOrigin('waimers.com', 'checkout', fb)` → `'https://checkout.waimers.com'`
  - `checkoutOrigin('shop.koomerce.app', 'checkout', fb)` → `'https://checkout.shop.koomerce.app'`
  - `checkoutOrigin('waimers.com', null, fb)` → equals `storefrontOrigin('waimers.com', fb)` (flag off → same origin)
  - `checkoutOrigin(null, 'checkout', fb)` → equals `storefrontOrigin(null, fb)` (no primary → fallback)
  - `checkoutOriginFor` (DB, mirrors the existing `storefrontOriginFor` cases): live primary wins; no/pending primary → fallback; never another store's domain.
- [ ] **Step 2: Run** `bun scripts/turbo.ts run test --filter=@commerce/core -- origin.test.ts` → FAIL.
- [ ] **Step 3: Implement** both functions in `origin.ts` (string build for the branded case; delegate to `storefrontOrigin*` otherwise).
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `feat(core): checkoutOriginFor — branded per-store checkout origin`.

### Task 2: Hand-off token

**Files:**
- Create: `packages/core/src/checkout/handoff.ts`
- Test: `packages/core/src/checkout/handoff.test.ts`

**Interfaces:**
- Produces:
  - `type Handoff = { storeId: string; cartId: string; customerId: string | null }`
  - `signHandoffToken(h: Handoff, secret: string, ttlMs?: number, now?: Date): string` — body `${storeId}.${cartId}.${customerId ?? '-'}.${expiresMs}`, purpose `checkout-handoff`, base64url HMAC appended; default TTL 2 min (`CHECKOUT_HANDOFF_TTL_MS`).
  - `verifyHandoffToken(token: string, secret: string, now?: Date): { ok: true } & Handoff | { ok: false; reason: 'malformed'|'expired'|'signature' }`.

- [ ] **Step 1: Write failing tests** (`handoff.test.ts`): round-trip returns the three fields; a tampered body → `signature`; an expired token → `expired`; a `balance:`-purpose token of the same shape → `signature` (purpose separation); `customerId: null` round-trips as absent.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** using the `balance-link.ts` HMAC/`timingSafeEqual` pattern (purpose `checkout-handoff`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(core): signed single-use checkout hand-off token`.

### Task 3: Store-origin hand-off target (`/checkout/start`)

**Files:**
- Create: `apps/storefront/src/lib/checkout-handoff.ts` (pure target-builder, unit-testable)
- Create: `apps/storefront/src/app/-s/[storeId]/checkout/start/route.ts` (thin route calling it)
- Modify: `apps/storefront/src/app/-s/[storeId]/cart/cart-contents.tsx` (the Checkout `<a>` → `/checkout/start`)
- Test: `apps/storefront/src/lib/checkout-handoff.test.ts`

**Interfaces:**
- Consumes: `signHandoffToken` (Task 2), `checkoutOriginFor` (Task 1), `readCartId` (`lib/cart-cookie.ts`), `readCustomerId` (`lib/customer-session.ts`), `CHECKOUT_SUBDOMAIN` from config.
- Produces: `checkoutHandoffTarget(opts: { storeId; cartId: string|null; customerId: string|null; subdomain: string|null; primaryHostname: string|null; fallbackOrigin: string; secret: string }): string` — returns `${checkoutOrigin(primary, subdomain, fallback)}/c/${token}` when `subdomain` set **and** the resolved origin differs from the store origin; otherwise returns `'/checkout'` (same-origin, flag-off or unprovisioned fallback). Empty cart → `'/cart'`.

- [ ] **Step 1: Write failing tests**: flag on + branded origin → `https://checkout.waimers.com/c/<token>` and the token verifies to the right store/cart; `subdomain=null` → `'/checkout'`; origin equals store origin (unprovisioned) → `'/checkout'`; no cart → `'/cart'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `checkoutHandoffTarget`; then the `route.ts` (reads cookies, computes `fallbackOrigin`/primary from the request + store, `NextResponse.redirect(target, 303)`); switch the cart button to `href="/checkout/start"`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(storefront): /checkout/start hand-off to the checkout origin`.

### Task 4: Checkout-origin redemption (`/c/[token]`) + session

**Files:**
- Create: `apps/storefront/src/lib/checkout-session.ts` (`CHECKOUT_SESSION_COOKIE`, read/write/clear; host-only, per `customer-session.ts`)
- Create: `apps/storefront/src/app/-s/[storeId]/c/[token]/route.ts` (redeem → set session → redirect to `/checkout`)
- Test: `apps/storefront/src/lib/checkout-session.test.ts`, `packages/core/src/checkout/redeem.test.ts`

**Interfaces:**
- Consumes: `verifyHandoffToken` (Task 2); cart read under RLS (`getCart`).
- Produces: `redeemHandoff(tx, { storeId, handoff }): Promise<{ ok: true; cartId } | { ok: false; reason: 'foreign'|'spent'|'empty' }>` in `packages/core/src/checkout/redeem.ts` — refuses when `handoff.storeId !== storeId` (foreign), when the cart is already converted to an order (spent / single-use), or empty. On ok, the route writes the checkout session cookie {storeId, cartId, customerId}.

- [ ] **Step 1: Write failing tests** (DB where needed): happy path returns the cart; foreign-store token → `foreign`; a cart already turned into an order → `spent`; expired/tampered token rejected at `verifyHandoffToken` (unit). Session cookie helper round-trips and is host-only.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `redeemHandoff` + the session helper + the route (verify → redeem → set cookie → `redirect('/checkout')`; on failure redirect to the store's `/cart` with a neutral message).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: redeem checkout hand-off into a host-only checkout session`.

### Task 5: Proxy `checkout.*` host branch

**Files:**
- Modify: `apps/storefront/src/proxy.ts`, `apps/storefront/src/lib/routing.ts` (+ a `checkoutHostname(host)` helper), `apps/storefront/src/lib/accounts-host.ts` sibling pattern
- Test: `apps/storefront/src/lib/routing.test.ts`, `apps/storefront/src/lib/csp-proxy.test.ts`

**Interfaces:**
- Consumes: `resolveHost` (store by hostname), `isIsolatedStorePath` + `ISOLATION_HEADERS` (phase A), `isCrossOriginBrowserRequest` (A-07).
- Produces: `routeForCheckoutHost(pathname): Route` — allow `/c/<token>` and `/checkout/**`; everything else `forbidden`. A host whose first label is `checkout` triggers this branch; the store is `resolveHost(host without the 'checkout.' label)`.

- [ ] **Step 1: Write failing tests**: a request to `checkout.shop.example/checkout` rewrites to the store's checkout and carries `frame-ancestors 'none'` + isolation headers; `checkout.shop.example/products/x` → 404; with the flag off the branch is inert (host still resolves as a normal store or 404); a cross-site POST to the checkout host is refused (A-07).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the `checkoutHostname` detection + `routeForCheckoutHost` + the proxy branch (mirror the `accountsHostname()` branch); when isolation is on, the normal store branch stops rewriting `/checkout` (serve only `/checkout/start`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(storefront): proxy serves checkout on the checkout.* host`.

### Task 6: Checkout pages read the checkout session

**Files:**
- Create: `apps/storefront/src/lib/checkout-context.ts` — `checkoutContext(): Promise<{ storeId; cartId } | null>` from the checkout session cookie, falling back to `{ storeId (from x-store-id), cartId: readCartId() }` when isolation is off (same-origin).
- Modify: the checkout pages/actions that call `readCartId()` directly to go through `checkoutContext()` (`checkout/page.tsx`, `components/checkout/*`, `lib/cart-actions.ts` paths used by checkout, `pay`/`balance`/`invoice`).
- Test: `apps/storefront/src/lib/checkout-context.test.ts`

**Interfaces:**
- Consumes: Task 4 session helper, `readCartId`, request headers (`x-store-id`).
- Produces: `checkoutContext()` used by every checkout render/action so the same code works same-origin and cross-origin.

- [ ] **Step 1: Write failing test**: with a checkout session cookie → returns its {storeId, cartId}; without, same-origin → falls back to header store + cart cookie; neither → null.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `checkoutContext`; route the checkout reads through it (smallest diff; no UI change).
- [ ] **Step 4: Run** the storefront checkout suites → PASS.
- [ ] **Step 5: Commit** `refactor(storefront): checkout reads cart via checkoutContext`.

### Task 7: Gateway return URLs & order emails use the checkout origin

**Files:**
- Modify: payment-init call sites (find via `bun run code-map payments` / gateway return/callback URL) and order-confirmation / balance / invoice email link builders.
- Test: the nearest existing unit around return-URL construction; else a focused test on the URL builder.

**Interfaces:**
- Consumes: `checkoutOriginFor` (Task 1).
- Produces: every gateway `return_url`/callback and emailed pay/thank-you link built from `checkoutOriginFor(store, CHECKOUT_SUBDOMAIN, storefrontFallback)` instead of the store origin.

- [ ] **Step 1: Write failing test** on the return-URL/link builder: flag on → `https://checkout.<primary>/...`; flag off → `https://<primary>/...` (unchanged).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** by swapping the origin source at those call sites.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: payment return URLs and pay links use the checkout origin`.

### Task 8: Config flag + rollout docs

**Files:**
- Modify: `packages/config/src/env.ts` (+ its test) — add optional `CHECKOUT_SUBDOMAIN`; `deploy/env.production.example`, `.env.example` (documented, blank).
- Modify: `docs/handoff/changes/2026-10-26-checkout-origin-isolation.md` (note phase B landed behind the flag, still off) and the design doc status.
- Create: `docs/handoff/changes/2026-10-26-checkout-origin-phase-b.md`.

- [ ] **Step 1: Write failing test** in `env.test.ts`: blank/absent `CHECKOUT_SUBDOMAIN` → unset; a value is kept; an invalid label (dots/spaces) → rejected.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the schema + examples + handoff doc.
- [ ] **Step 4: Run** → PASS; then `bun run lint`, `bun scripts/turbo.ts run typecheck --filter=@commerce/storefront --filter=@commerce/core`.
- [ ] **Step 5: Commit** `feat: CHECKOUT_SUBDOMAIN flag + phase B rollout notes`.

### Task 9: TLS / ingress for `checkout.*` (infra — owner/ops, not merged code)

Not a code task; folded here so it isn't lost. Wire the storefront app's ingress (Dokploy/Traefik) to accept `checkout.*` hosts and issue on-demand Let's Encrypt per host (reuse the auto-https path, `docs/handoff/changes/2026-10-07-auto-https-domains.md`). For custom-domain stores, surface the `checkout` CNAME step in the admin domain UI. Verify on staging (`checkout.vioratech.in`) before setting `CHECKOUT_SUBDOMAIN` in production. Documented in the design doc's rollout section; executed during the quiet-window cutover.

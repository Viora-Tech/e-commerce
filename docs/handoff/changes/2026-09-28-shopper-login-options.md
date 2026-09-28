# Shopper login options: Google (and One Tap), Apple, Facebook, Truecaller, magic link, passkeys, Remember this device

**Shopper login options** (28 September 2026, `feat/shopper-login-options`, migration
`0076_shopper_login`: tables `customer_identity`, `customer_passkey`, `customer_login_ticket`
(all store-scoped under RLS), column `store.login_providers`; renumber if another migration
lands first). Settings → Customer accounts now has a switch per method: Google, Apple,
Facebook and Truecaller (each "ready to use" on the platform's apps from `SHOPPER_*` env, or
"Use my own app" with a guided setup sheet and encrypted secrets), Google One Tap (own Google
app only), sign-in link by email, passkeys and "Remember this device". The storefront sign-in
card shows only enabled, working methods (`signInOptions`, `quickSignInButtons`), mobile first.

Provider sign-in runs on one platform login domain, `ACCOUNTS_URL` (default
`https://accounts.<PLATFORM_STORE_DOMAIN>`, answered by the storefront proxy under the internal
`/-a` prefix), then hands the session back with a signed, 2-minute, single-use ticket bound to
the store, the exact return URL on one of the store's active domains, and the starting
browser's cookie. Accounts link by provider id, then by a verified email or Truecaller-verified
mobile; an unverified email (Facebook) is confirmed with an email code first, never linked
blindly. Passkeys register on the store's own hostname (rpID). Built on Better Auth 1.7.6's
provider modules and `@simplewebauthn` 13 as libraries (not `betterAuth()`: shoppers are
per-store customers). Code: `packages/core/src/shopper-login/`, storefront
`src/lib/{shopper-login,login-actions}.ts` and `src/app/-a`, admin
`components/settings/{sign-in-providers-card,sign-in-extras-card,login-app-sheet}.tsx`. Docs:
developer docs "Shopper login options" (flow, hand-off diagram, security table, localhost
setup), merchant guide Settings → Customer accounts.

**Open**: Truecaller written from its published web flow while its docs host was blocked;
verify parameter names on the Truecaller portal before switching it on for real. Provider
buttons are plain text (the storefront has no icon set); brand-guideline logos are a
follow-up. Passkeys made on an old domain stop working after a domain move (WebAuthn related
origins would fix it; partial browser support). No end-to-end run against real Google, Apple,
Facebook or Truecaller yet (needs the owner's apps and the `accounts.` DNS record).

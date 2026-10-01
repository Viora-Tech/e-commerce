# Security audit owner decisions D-01 to D-13, script CSP

**Owner decisions** (1 October 2026, `fix/security-owner-decisions`, migration
`0079_security_owner_decisions`; merges after #218 and #219). The resolution table is at the end
of "Owner decisions" in `docs/security/2026-09-28-security-audit.md`. What a new session needs
to know:

- **Client IP**: `TRUSTED_PROXY=cloudflare|none` (default `none`). Only `cloudflare` believes
  `cf-connecting-ip`; `x-forwarded-for` is never believed. Production must firewall the origin
  to Cloudflare's ranges and set `TRUSTED_PROXY=cloudflare` (deployment runbook). Pass the
  socket peer to `clientIp(headers, { peer })` where the framework has one (worker:
  `peerAddress`).
- **Webhooks** answer every rejection with the same `400 {"ok":false}`
  (`apps/worker/src/webhook-reply.ts`); keep it that way for new routes.
- **Storefront server actions** never take a store id: use `requestStoreId()`
  (`apps/storefront/src/lib/request-store.ts`). The `storefront-action-store` sweep enforces it.
- **Truecaller**: an existing customer's number links only after a phone code
  (`verify_phone` / `phone_code_sent` tickets, `confirmTruecallerPhone`,
  `confirmTruecallerCodeAction`); offered only top-level on the store's own origin.
- **Passkeys**: challenges in `customer_login_ticket` (`passkey_register` / `passkey_login`),
  single use; user verification required.
- **Plan invites**: `signup_invite.plan_order_id`; refund or cancel of the plan order expires
  them (`revokePlanInvitesForOrder`, from the relay).
- **Checkout**: state must fit the PIN (`state_mismatch`, `checkout/pincode-state.ts`); gift
  cards do not count toward the minimum order or the COD limit (`checkoutRuleSubtotalPaise`).
- **Newsletter**: double opt-in. `requestNewsletterSignup` → outbox
  `newsletter.confirm_requested` → `newsletter_confirm` email (job carries `signupId`, empty
  `orderId`) → `/newsletter/confirm/<token>` → `confirmNewsletterSignup`. Nothing touches a
  customer before the button is pressed.
- **Erasure** also covers return photos (files too; `anonymiseCustomer` takes `secret` and
  `storage`), courier tracking and webhook payloads, `customer_otp`, back-in-stock and newsletter
  signups.
- **Deploy**: worker and backup on an `egress` network; compose and the env example carry
  `SHOPPER_*`, `ACCOUNTS_URL`, `TRUSTED_PROXY` and the platform keys (`deploy-compose` sweep).
  Workflow actions pinned to SHAs (`pinned-actions` sweep).
- **CSP**: both apps set a nonce script policy in `proxy.ts` (`apps/*/src/lib/csp.ts`). A new
  inline script must carry the nonce (`headers().get('x-nonce')`); report-only in development.
  The admin now has a `proxy.ts`.
- **Dev OTP readback** (`/api/dev/otp`) is 404 in any production build.
- **CSP checked in production builds** (headless Chromium, both apps, throwaway DB): storefront
  home, collections, product, cart, checkout, thank-you, sign-in, search, policies, 404 (store
  and root), newsletter confirm, unsubscribe, theme preview framed by the admin (bridge posts
  `theme-preview:ready`); GA4, Tag Manager and Meta pixel load under the nonce, and Razorpay,
  Cashfree and Google sign-in scripts load through `strict-dynamic`. Admin: login, home, orders,
  order, products, product, customers, analytics, themes, theme editor (a section dragged in and
  one added), settings pages, Apps (Delhivery, Shiprocket, RapidShyp), content, discounts. No
  violations. Fixed on the way: courier constants come from each package's `/client` entry (the
  adapter root pulled Node polyfills whose `Function()` probe tripped the policy; the
  `client-imports-server` sweep now covers RapidShyp too), Zod `jitless` in both
  `instrumentation-client.ts`, the storefront root `not-found` renders per request, and the
  Tag Manager loader copies the nonce onto `gtm.js` (merchant step for inline Custom HTML tags:
  merchant guide, Online Store → Preferences).

**Open**: D-08 (RapidShyp RTO codes) waits on RapidShyp's status table. The storefront checkout
page throws React hydration error #418 in production with or without the CSP (not caused by
it); it needs its own look.

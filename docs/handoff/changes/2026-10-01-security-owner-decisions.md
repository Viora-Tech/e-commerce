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

**Open**: D-08 (RapidShyp RTO codes) waits on RapidShyp's status table. The CSP has unit tests
but was not checked in a production build in a browser; check GTM custom-HTML tags (they need
GTM's nonce variable) before go-live.

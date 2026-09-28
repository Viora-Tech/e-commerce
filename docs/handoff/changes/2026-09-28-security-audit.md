# Security audit of everything merged since 25 September, and its fixes

**Security audit** (28 September 2026, `fix/security-audit-2026-09`, migration
`0077_customer_phone_verified`: `customer.phone_verified_at`). The report, with every finding,
exploit, fix, test and the owner decisions, is `docs/security/2026-09-28-security-audit.md`.
What a new session needs to know:

- **Phone sign-in** (Truecaller too) only matches a customer whose phone was proven (a phone
  code or Truecaller sets `phone_verified_at`) or who has no email: `accounts/phone-proof.ts`.
  Checkout keeps a proven phone; profile, staff edits and imports clear the proof when they change
  the number. Existing customers with an email start unproven.
- **Host header** must be `host[:port]` (`parseHostHeader` / `originFromHost` in
  `apps/storefront/src/lib/store-resolver.ts`); every emailed or SEO origin comes from it, never
  `x-forwarded-host`.
- **Sign-in codes**: code row locked on verify, wrong guesses carry over resends for an hour
  (`attemptsCarriedOver`), limiter keys via `otpLimiterId(storeId, kind, raw)`.
- **Return paths**: `safeNextPath` is the one sanitiser (`safeReturnTo` calls it).
- **Connect a provider**: linked only on the store domain after the browser check
  (`planConnect`, hand-off status `connect`, `/account/login/complete`).
- **Payments**: gateway events reporting less than the attempt are stored, never applied
  (`gatewayPaidTooLittle`); Razorpay payments without our Razorpay order are ignored; Razorpay
  dedupes on `event:entityId`. The test `GatewayDouble` reports the order amount.
- **Secrets**: `mergeMaskedSecrets` refuses to keep a stored secret when `baseUrl`, `endpoint`,
  `host`, `accountId` or `bucket` changes; courier base URLs must be on the courier's domain
  (`courierBaseUrlProblem`); test-connection needs settings.manage; R2 `accountId` is 32 hex.
- **SSRF**: fetch any user-influenced URL through `@commerce/core/safe-fetch` (`safeFetch`,
  `readCapped`). The Shopify importer's media and Truecaller use it.
- **Uploads**: presigned PUTs sign `content-type`; `confirmUpload` refuses a type mismatch; the
  local upload route goes through `authorizeLocalUpload` and `readCappedBody`; a final pipeline
  failure deletes the unprocessed object; non-raster bytes are refused.
- **Admin-supplied ids** that become foreign keys are checked under RLS first
  (`core/src/store-scope.ts`: drafts, gift cards, variant images; privacy requests).
- **Marketing** goes only to the consenting customer's own stored email or phone
  (`marketing/recipient.ts`); only the first WhatsApp step of a COD automation is transactional.
- **Theme**: section settings, element styles and Custom HTML (`class` is no longer kept) are
  cleaned; twelve sections route hrefs through `safeHref`.
- **Deploy**: `.dockerignore` excludes `**/.env*`; the release deploy job has no token;
  `init.sh` passes the password as a psql variable.

**Open, for the owner** (report, "Owner decisions"): trust `cf-connecting-ip` only behind a
Cloudflare-locked origin; pin release actions to SHAs; Truecaller phishing and passkey challenge
storage; plan invites on refund; checkout `stateCode`; gift cards and the minimum order;
RapidShyp RTO codes; newsletter double opt-in; erasure of return photos and courier payloads;
compose `internal` network egress and missing `SHOPPER_*` env.

DB-backed tests ran locally against Postgres 16 and Redis (the repo targets Postgres 17).

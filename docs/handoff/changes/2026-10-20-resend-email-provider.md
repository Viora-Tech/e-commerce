# Email: Resend as a second platform provider, with optional fallback

Branch `feat/resend-email-provider`. No migration. Docs: developer docs "Email sending and sender
domains" (`apps/docs/content/developer-docs/operations/email-sending.mdx`).

- **New package `packages/notifications-resend`**: `ResendChannel` (`NotificationChannel` with
  `send` and `sendMarketing`) posting to `https://api.resend.com/emails` with plain `fetch`, no
  SDK and no new third-party dependency. From name via `formatMailbox` (now also exported as
  `@commerce/notifications-ses/address`), `reply_to`, attachments (base64 + `content_type`),
  marketing headers, tags (`template=<id>` / `kind=marketing`), 15 s timeout. Tests mock fetch;
  there is no live Resend suite.
- **`SendResult` failures may carry `retryable: true`** (`@commerce/notifications`): the provider
  failed, not the message. SES sets it for throttling, paused/suspended account, 429/5xx, SDK
  `$retryable`/`$fault: server` and socket errors; Resend for no answer, 429 and 5xx.
- **`withFallback(primary, secondary)`** (`packages/notifications/src/fallback.ts`): second channel
  only after a retryable failure; keeps the primary's id; prefixes the provider ref (`resend:…`).
- **Platform account** (`packages/core/src/sender-email/platform.ts`, now exports
  `platformEmailFromEnv` for tests): `SENDER_EMAIL_PROVIDER=dev|ses|resend`,
  `SENDER_EMAIL_FALLBACK=none|ses|resend`, `RESEND_API_KEY`. Missing keys for either fail at first
  use naming them.
- **Decision: store sender domains stay on SES.** Resend's Domains API uses different DNS records
  (TXT DKIM + `send.` MX/SPF), so supporting it would mean a second record shape in
  `sender_email`, the record builder and the card, and double DNS work for merchants when a
  fallback is on. A verified store domain always sends via SES; its fallback (Resend) sends from
  the platform address with Reply-To the shop. With `resend` and no SES keys, starting a store
  domain fails with a clear provider error and verified domains send from the platform address.
- **Fix**: `loadPlatformEmailEnv` now treats blank values as unset, like `loadEnv` (compose passes
  `SES_CONFIGURATION_SET: ""` etc.).
- **Bounces/complaints**: still not wired for either provider (no SES SNS handler exists), so no
  Resend webhook was added. Follow-up in the docs page.
- Deploy: `SENDER_EMAIL_FALLBACK` and `RESEND_API_KEY` added to `x-app-env` in
  `deploy/docker-compose.prod.yml`, `deploy/env.production.example` and `.env.example`.

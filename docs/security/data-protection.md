# Data protection

What this platform encrypts, where the keys live, how to rotate them, how backups are
protected, who can see what, and what that means under India's Digital Personal Data
Protection Act (DPDP), 2023. Written for a merchant or auditor, not just engineers.

## What is encrypted at rest

**Provider credentials.** Every payment, shipping, notification and storage connector
declares which of its config fields are secrets (`secret: true` on a `ProviderField`,
`packages/{payments,shipping,notifications,storage}-*/src/*.ts`). Razorpay's `key_secret`,
Delhivery's and Shiprocket's API tokens, SES's secret access key, WhatsApp's access token
and R2's and S3's secret access keys are all flagged this way; public identifiers like Razorpay's
`key_id` are not. A field name matching `/secret|token|password/i` is also encrypted even
if a connector forgot to flag it (`packages/core/src/settings/secrets.ts`'s `SECRET_KEY`
regex) — a safety net, not the primary mechanism; `scripts/sweeps/secret-fields.test.ts`
fails the build if a connector adds a credential-looking field without `secret: true`.
The Shopify importer's stored Admin API token (`shopify_import_connection.access_token`)
and gift card codes (`gift_card.code_cipher`) use the same primitive directly.

**Customer phone numbers.** `customer.phone` is encrypted (see "Scope" below for what
isn't). A merchant or shopper editing a phone number never sees or sends ciphertext; the
admin customer list, segments, campaign sends and account pages all decrypt at the point
they read the column.

**Encryption**: AES-256-GCM, `packages/core/src/secrets.ts`. The key is SHA-256 of
`SETTINGS_SECRET`, so any string works as a key; the ciphertext format
(`v2.<keyId>.<iv>.<tag>.<ct>`) stamps which key encrypted it so decryption doesn't have to
brute-force a list of candidates. GCM's auth tag means a tampered or truncated ciphertext
fails to decrypt rather than silently returning garbage.

### Scope: what stays plaintext, and why

Only `customer.phone` is encrypted in this pass, not every phone number in the schema:

- `address.phone` and `customer_address.phone` — order shipping-address snapshots and the
  shopper's saved address book. These print on shipping labels, invoices and packing
  slips; encrypting them would mean decrypting on every one of those paths (label
  generation, GST invoice PDFs, the admin order detail's address card) for a column that,
  unlike the customer profile, is not searched or looked up by equality anywhere. Planned
  as a follow-up once those print paths are inventoried.
- `cart.phone` — the checkout-in-progress and abandoned-cart-recovery contact. Recovery
  automations read it directly (`packages/core/src/marketing/automations.ts`); a cart is
  also short-lived (converts to an order or expires) compared to a customer record.
- `customer.default_address` (the JSON snapshot of a customer's latest order address,
  including its own `phone`) — same reasoning as `address.phone` above; it is a denormalised
  copy of data that already lives, plaintext, on the order.
- `marketing_automation_run.phone` — a point-in-time snapshot taken when a shopper is
  enrolled (from the now-encrypted `customer.phone`, decrypted once at enrolment), kept so
  a run's WhatsApp send doesn't need to re-decrypt the customer row on every step.
- The Shopify importer (`packages/plugin-shopify-import/src/write-customers.ts`) still
  writes and matches `customer.phone` in clear. Its `eq(customer.phone, ...)` dedupe check
  needs to move to the blind index (below) to work at all once other customers on the same
  store have an encrypted phone; tracked as a follow-up, not done in this PR.

City, state and pincode are never encrypted — they are used in `WHERE`/`GROUP BY`/`ORDER
BY` for filters, tax (GST split by state) and reporting, and are the coarse categories
DPDP treats as far less identifying on their own than a phone number.

### Search: equality, not substring

Encryption means Postgres can no longer `ILIKE` a phone number. Every encrypted phone
carries a deterministic **HMAC-SHA256 blind index** (`customer.phone_index`,
`phoneBlindIndex()` in `packages/core/src/customers/phone-crypto.ts`): the same phone,
however it's formatted (spaces, dashes, `+91`), hashes to the same index, so looking one
up means hashing the query and comparing indexes — the database never decrypts a row to
answer "does this match". The admin customer search box detects a phone-looking query
(4+ digits) and switches from `ILIKE` (name/email) to an index equality match; this is a
real, deliberate trade-off, not a bug: searching "987" no longer finds "9876543210" the
way it used to when the column was plaintext. A full phone number still finds its
customer instantly.

## Key storage

- `SETTINGS_SECRET` — encrypts provider credentials and `customer.phone`. Any string
  16+ characters; dev/test fall back to `dev-only-settings-secret` if unset
  (`packages/config/src/env.ts`) — **never rely on that default outside dev**.
- `SETTINGS_SECRET_PREVIOUS` — comma-separated retired `SETTINGS_SECRET` value(s), read
  only while a rotation is in flight (see below).
- `BACKUP_ENCRYPTION_KEY` — separate key, encrypts backup archives only (next section).
  Deliberately not the same value as `SETTINGS_SECRET`: a leaked app secret should not
  also open the backups, and vice versa.

- `SES_ACCESS_KEY_ID` / `SES_SECRET_ACCESS_KEY` — the platform's own Amazon SES account, which
  sends for every store that has no SES app of its own and holds each store's sender domain
  (`sender_email`). Read from the environment only, never stored in or read from the database.
  The `sender_email` table holds no secrets: only the address, domain and public DKIM tokens.

Store these as deployment secrets (Coolify/Dokploy environment, or your platform's
secret manager) — never in the repo, never in a `.env` committed anywhere. `.env.example`
documents the variable names, not real values.

## Key rotation runbook

1. Generate a new random secret (32+ bytes, e.g. `openssl rand -hex 32`).
2. Deploy with `SETTINGS_SECRET_PREVIOUS` set to the **current** (soon-to-be-old) value,
   and `SETTINGS_SECRET` set to the new one. Both keys now work for decryption; only the
   new key is used for new writes.
3. Run `bun run rotate-secrets` (dry run) to see what it would touch, then
   `bun run rotate-secrets --apply`. It walks every store's provider settings, gift card
   codes, Shopify import connection tokens and customer phones, re-encrypting anything
   still under an old key and recomputing `customer.phone_index` under the new key. Run it
   soon after the deploy: phone search cannot find a customer whose index is still under
   the old key. Settings blobs are also re-encrypted whenever they are saved (lazy rotation).
4. Once a dry run reports zero values left, remove `SETTINGS_SECRET_PREVIOUS` and redeploy.
   Anything still encrypted under the retired key would now fail to decrypt, so don't skip
   step 3.

The script is dry-run by default, updates one store per transaction, exits 1 if any value
opens under no key, and is safe to run more than once (a value already under the current
key is left alone). `scripts/backfill-phone-encryption.ts` is only for phones still in
**plaintext** (rows from before phone encryption). Full runbook: developer docs, Operations,
Key rotation (`apps/docs/content/developer-docs/operations/key-rotation.mdx`).

## Backups

`scripts/backup-db.ts` (`docs/ops/backups.md`) streams the Postgres dump and uploads
folder through AES-256-GCM (`packages/backup/src/crypto.ts`) before it ever reaches R2 or
a local folder, keyed by `BACKUP_ENCRYPTION_KEY`, chunked (4 MiB plaintext per chunk) so a
multi-GB dump never needs the whole file in memory twice and a truncated tail fails its
own auth tag rather than restoring corrupt data silently. Production refuses to write an
unencrypted backup if `BACKUP_ENCRYPTION_KEY` is unset; dev prints a warning and proceeds
unencrypted, so a laptop backup script doesn't need a key just to test the retention
logic. `scripts/restore-db.ts` decrypts transparently — an unencrypted (pre-this-change)
archive still restores; the format is self-describing (`CMBK` magic bytes) and refuses
to guess.

## Access control

- **Row-Level Security**: every tenant table carries `store_id` and is under Postgres RLS
  (`apply_store_rls()`, `docs/architecture.md`) — a query for store A's data cannot return
  store B's rows even from a bug in application code.
- **Two DB roles**: `app` (RLS-restricted, what the running apps use) and `owner`
  (full schema access, used only by migrations, backup/restore and the scripts in this
  doc). Application code never runs as `owner`.
- **Admin roles and permissions**: 31 typed permissions, `can(permission)` gates on
  (almost) every oRPC procedure (`docs/guardrails.md`, "Router idiom"); `CUSTOMERS_READ`
  gates seeing a phone number at all, `CUSTOMERS_WRITE` gates changing one.
- **OTP/credentials are never logged or read back**: session tokens and login codes are
  hashed before storage (`packages/core/src/accounts/auth.ts`); nothing in this codebase
  or its scripts reads a raw OTP or password out of the database.

## AI features

"Write with AI" and "Ask your store" (`packages/ai`, developer docs "AI engine") send data to an
AI model through one platform gateway key (Vercel AI Gateway or OpenRouter), set as a deployment
secret like the others above (`AI_GATEWAY_API_KEY` / `OPENROUTER_API_KEY`), never per merchant
and never in the database.

- **Sent**: for the product writer, the product's title, type, brand, tags, description, the
  merchant's notes and up to three product photos; for store questions, the question, the last
  three turns and tool results, which are aggregates, product names and order numbers.
- **Never sent**: customer names, emails, phone numbers or addresses. The store tools
  (`packages/api/src/services/ai/store-tools.ts`) do not select those columns at all.
- **Never stored or logged**: prompts and answers. `ai_usage` keeps counts only (calls, input and
  output tokens per store, month and feature).
- **Nothing changes without the merchant**: the writer suggests and the merchant applies and
  saves; the store tools are read-only; any future write tool goes through the engine's approval
  step.

## Transport and disk encryption

- **TLS**: the storefront and admin apps sit behind Cloudflare/the load balancer, which
  terminates TLS; `DATABASE_URL`/`DATABASE_URL_OWNER` should use `sslmode=require` (or
  stronger) once Postgres is not colocated with the app, matching whatever the hosting
  Postgres instance (Lightsail, RDS, etc.) offers.
- **Disk encryption**: this is an infrastructure setting, not application code — enable
  encrypted volumes on whichever host runs Postgres and the backup target (Lightsail
  volumes, R2 is encrypted at rest by Cloudflare by default). Nothing here substitutes
  for it; application-level encryption protects specific columns even if a disk snapshot
  leaks, disk encryption protects everything else (order lines, addresses, the rest of
  the schema) that this PR does not touch.

## DPDP Act, 2023 notes

Not legal advice; a plain-language pointer to where the platform's design already lines
up with the Act, for a merchant filling out their own compliance paperwork.

- **Consent**: `customer.accepts_marketing` / `accepts_whatsapp` and
  `marketing_consent_at` / `_source` record when and where consent for each channel was
  given (`docs/plugins.md` / `packages/core/src/customers/newsletter.ts`); an unsubscribe
  link stops every future send (`customer.unsubscribed_at`).
- **Purpose limitation and minimisation**: this document's "scope" section above is also
  the record of exactly which personal data is encrypted versus plaintext and why —
  useful evidence that the choice was deliberate, not an oversight.
- **Right to access/correction**: the admin customer detail page and the shopper's own
  account page are the two paths that read/write `customer.phone`; both already exist.
- **Right to erasure**: `deleteCustomer` (`packages/api/src/services/customer.service.ts`)
  refuses while orders still reference the customer (financial/tax records must be kept),
  matching DPDP's carve-out for data a business is legally required to retain.
- **Breach notification**: the encryption and access-control measures on this page are
  the technical controls a breach-notification assessment would point to; this platform
  does not currently have an automated breach-detection/alerting system (see `docs/handoff.md`
  queued work — GlitchTip error tracking is on the list but is not a security monitoring
  tool by itself).

## See also

- `docs/guardrails.md` — the `secret-fields` sweep that keeps provider credentials
  flagged correctly.
- `docs/ops/backups.md` — backup/restore mechanics; this doc covers only their encryption.
- `scripts/rotate-secrets.ts`, `scripts/backfill-phone-encryption.ts` — the two rotation
  scripts referenced above.

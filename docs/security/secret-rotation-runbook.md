# Secret rotation & leaked-credential runbook

**When to use this:** a secret may be exposed — a key pasted into a log/ticket/chat, a laptop or
CI compromised, an env dump leaked, a dependency or platform breach (cf. the Railway incident,
21 Oct 2026, where stored env vars were read), or a staff offboarding where someone held prod
secrets. When in doubt, rotate — rotation is cheap here and designed to be zero-downtime.

This repo already supports rotation: encrypted blobs carry a key id (`v2.<keyId>.…`), decryption
tries the current key then each retired key (`SETTINGS_SECRET_PREVIOUS`), and
`scripts/rotate-secrets.ts` re-encrypts every stored blob under the new key.

## The secrets, by blast radius

| Secret (env var) | What it protects | If leaked |
|---|---|---|
| **`SETTINGS_SECRET`** | AES-GCM key for **every store's** gateway keys, connector tokens, login-provider secrets, **customer phone numbers** (+ blind index), **gift-card codes** | Highest value. Rotate + re-encrypt all blobs. |
| **`BACKUP_ENCRYPTION_KEY`** | Nightly backup archives in `koomerce-backup` (separate key by design) | Backups readable *if* the attacker also has the archives. Rotate; past archives stay under the old key until re-encrypted/expired. |
| **`AI_GATEWAY_API_KEY` / `OPENROUTER_API_KEY`** | AI inference spend (LLMjacking target) | Rotate at the gateway immediately; cap monthly budget. |
| **`AUTH_SECRET`** | Admin/Better-Auth sessions | Rotate → signs all admins out. |
| **Per-gateway keys** (Razorpay/Cashfree/Decentro), courier/storage tokens | One store's money/shipping/storage | Rotate at the provider, re-save in admin; `mergeMaskedSecrets` refuses stale on host change. |
| **`DATABASE_URL` / `DATABASE_URL_OWNER` passwords** | DB access (`app` = RLS-restricted; owner = full) | Rotate the Postgres roles + redeploy. |

## A. Rotate `SETTINGS_SECRET` (the big one) — zero downtime

1. **Generate** a new 32+ char random value: `openssl rand -base64 32`.
2. **Keep the old key for decryption.** In the server env:
   - `SETTINGS_SECRET_PREVIOUS` = the *current* (about-to-be-retired) value. If one is already
     there, append comma-separated (newest-retired first): `SETTINGS_SECRET_PREVIOUS=old1,old2`.
   - `SETTINGS_SECRET` = the **new** value.
3. **Deploy** both env changes together. The app now encrypts new writes under the new key and
   still decrypts old blobs via `SETTINGS_SECRET_PREVIOUS`. Nothing breaks at this point.
4. **Dry-run the re-encryption** (reads `DATABASE_URL_OWNER`, reports only):
   ```
   bun run rotate-secrets
   ```
   Review the per-store counts. **`unreadable > 0` means a blob no key opens** — do not proceed;
   add the correct retired key to `SETTINGS_SECRET_PREVIOUS` and re-run until unreadable is 0.
5. **Apply** (each store re-encrypted in one transaction; idempotent):
   ```
   bun run rotate-secrets --apply
   ```
   Covers store payments/notifications/shipping/storage/login_providers blobs, `gift_card.code_cipher`,
   `customer.phone` (+ recomputes `phone_index`), and `shopify_import_connection.access_token`.
6. **Confirm**, then **remove the retired key**: once a second `bun run rotate-secrets` dry-run
   reports 0 to move, drop the old value from `SETTINGS_SECRET_PREVIOUS` and redeploy, so the
   retired key no longer lives in the env.

## B. Rotate `BACKUP_ENCRYPTION_KEY`
1. New value (`openssl rand -base64 32`); set `BACKUP_ENCRYPTION_KEY`, deploy.
2. New nightly backups use it immediately. Old archives stay under the old key — keep the old
   value somewhere safe (a sealed note / secrets manager) until those archives age out of
   `koomerce-backup`, or they become unrecoverable. Verify a fresh backup restores in staging.

## C. Rotate AI / gateway keys (`AI_GATEWAY_API_KEY`, etc.)
1. Mint a new key at the gateway; **set a hard monthly budget cap**.
2. Set the env var, deploy. Revoke the old key at the gateway.
3. Check `/settings/ai` → Activity for anomalous spend before and after.

## D. Rotate `AUTH_SECRET` (admin sessions)
1. New value, deploy. All admins are signed out and must log in again — expected.

## E. Rotate DB passwords
1. `ALTER ROLE app WITH PASSWORD '…';` and the owner role as needed (as the Postgres superuser).
2. Update `DATABASE_URL` / `DATABASE_URL_OWNER` to match, deploy. (The `app` role must stay
   `NOBYPASSRLS` and own no tables.)

## Full "a key leaked" drill (worst case: assume env dump)
Do in this order, fastest-revoke first:
1. **Contain the foothold** — if the origin/Dokploy/AWS was reached, cut access first (see the
   infra tracker I-01: lock origin 80/443 to Cloudflare), else rotation is futile.
2. **AI/gateway keys** (C) — revoke at the provider; cheapest to abuse, so kill first.
3. **Per-gateway payment keys** — rotate at Razorpay/Cashfree/Decentro, re-save in admin.
4. **`AUTH_SECRET`** (D) — sign everyone out.
5. **`SETTINGS_SECRET`** (A) — full rotate + `rotate-secrets --apply`.
6. **`BACKUP_ENCRYPTION_KEY`** (B) and **DB passwords** (E).
7. **Invalidate app tokens / sessions**, review `platform_audit_event` and AI activity for abuse
   during the exposure window, and notify any affected store owners.
8. Record the incident and timeline in `docs/security/`.

## F. I-07 — move crown secrets into a managed store (do at the EC2→Lightsail cutover)

**Why it's an ops change, not a code change.** The app reads every secret from `process.env`
(`loadEnv(process.env)`, `settingsSecret()`), validated by a zod schema with fail-fast and rotation
support. It does not care *how* the env is populated. So I-07 is about the source of those env
vars at container start, not application logic — there is no safe code-only fix, and the decrypt
path (`SETTINGS_SECRET`) must never be touched blind. **Current posture (verified 25 Oct):** no
secret value is in any committed file (`.env` is gitignored and untracked; only empty placeholders
in `.env.example` / `deploy/env.production.example`); the values live in Dokploy's env config on
the origin host. Residual risk is only an env dump by someone with Dokploy/SSH access — now 2FA-gated
(CP-01/CP-02) with origin ports moving behind the tunnel. Hence **Low**, and best sequenced with the
Lightsail migration, where the secrets are provisioned fresh on a new box regardless.

**Procedure (at Lightsail cutover — see `memory/cloudflare-tunnel-setup.md`):**
1. Create one secret per environment in **AWS Secrets Manager** (region `ap-south-1`), e.g.
   `koomerce/prod/app` holding the JSON of crown keys (`SETTINGS_SECRET`, `SETTINGS_SECRET_PREVIOUS`,
   `BACKUP_ENCRYPTION_KEY`, `AUTH_SECRET`, `AI_GATEWAY_API_KEY`, DB passwords). Give the Lightsail
   instance role **read-only** `secretsmanager:GetSecretValue` on just that ARN (same IAM-role pattern
   already used for ECR pulls — no static AWS keys).
2. Inject at container start, **additively and off by default**: an entrypoint wrapper fetches the
   secret JSON *only when* `AWS_SECRETS_MANAGER_SECRET_ID` is set and exports each key into the
   environment *before* the app's `loadEnv` runs; with the var unset it is a no-op and the app keeps
   using plain env. (Keep the fetch in the entrypoint, not app code, so a Secrets Manager outage
   fails the deploy loudly instead of booting half-configured.) This makes the change safe to land on
   a branch now and activate only once the secret is provisioned.
3. Cut over on the new box only: set `AWS_SECRETS_MANAGER_SECRET_ID`, deploy, confirm the app boots
   and can decrypt an existing store's gateway keys **in staging/a canary** before removing the plain
   values from Dokploy env. Roll back = unset the var (plain env still present) and redeploy.
4. Rotate `SETTINGS_SECRET` as part of the move (section A) so any value that ever sat in plain env
   is retired, with `SETTINGS_SECRET_PREVIOUS` carrying the old key until `rotate-secrets --apply`
   reports 0 to move.

## Keep the blast radius small (preventive)
- Move crown keys out of flat `.env` into AWS Secrets Manager / SSM or Dokploy's restricted
  secret store (infra tracker **I-07**; concrete steps in section F).
- Keep `SETTINGS_SECRET` and `BACKUP_ENCRYPTION_KEY` **different** (already the case).
- Budget-cap the AI key (**I-08**). Never log secrets (the `scrubPii` scrubber covers Sentry).
- Rehearse this runbook on staging at least once so step 4's "unreadable" case isn't a surprise
  during a real incident.

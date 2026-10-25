# Security: low-severity code hardening (C-01, C-02, C-03, C-07; C-04/I-07 resolved)

**Branch** `security/low-code-hardening` from `main`. Clears the low-severity code findings
from `docs/security/2026-10-24-infra-pentest.md`. Built the night before the 2026-10-26 launch
**on a branch, not deployed** — merge after launch. No schema change, no app (web/admin) code
touched.

## Done

- **C-01 — cart-recovery token domain separation** (`packages/core/src/cart/abandoned.ts`).
  `recoveryToken`/`verifyRecoveryToken` signed the bare body `<cartId>.<expires>` with the raw
  secret — the only signed-link helper without a purpose prefix. Now the shared `sign()` HMACs
  `recovery:<body>`, matching `preorder/balance-link.ts` (`<purpose>:<body>`). A recovery token
  can no longer be confused with another `<id>.<expiry>` token signed under the same secret.
  **Invalidates in-flight recovery links** (7-day TTL — acceptable, and blast radius is ~zero
  pre-launch). Tests in `abandoned.test.ts`: existing round-trip/tamper/expiry still green, plus
  a new case asserting a bare-scheme (no-prefix) HMAC is rejected.

- **C-02 — payment amount-guard centralised** (`packages/core/src/payments/confirm.ts`,
  `webhook.ts`). The "a gateway-reported amount must cover the attempt" invariant used to live only
  in `webhook.ts`. Moved it into `applyPaymentStatus` — the single choke point every capture path
  goes through: new optional input `capturedAmountPaise`; when present and the attempt would move to
  `authorized`/`captured`, `gatewayPaidTooLittle(p.amountPaise, capturedAmountPaise)` refuses the move
  and returns `rejected: 'underpaid'` with the attempt row untouched. `webhook.ts` now passes
  `capturedAmountPaise: e.amountPaise` and, on `rejected`, writes the same `amount mismatch …` note on
  the `payment_event` and returns `applied:false` as before — identical external behaviour, now with
  one owner of the invariant. The non-webhook paths (manual, COD, balance, expiry, client-confirm)
  pass nothing → guard skipped, behaviour unchanged. Removed the now-dead `paymentAmountFor` helper
  (its only caller was the webhook). Existing integration test `webhook.test.ts` ("keeps an order
  unpaid when the gateway reports less than the attempt") covers the centralised path unchanged.

- **C-03 — migration self-applies RLS** (`packages/db/drizzle/0078_store_data.sql`).
  Appended `SELECT apply_store_rls();` at EOF (behind a `--> statement-breakpoint`), like every
  other table-adding RLS migration (e.g. `0012`, `0014`). `store_export`'s policy was only applied
  by `0079` before; a future squash/reorder could have dropped it. **Idempotent** — `apply_store_rls()`
  is called by every migration — so production (already past `0079`) is unaffected; only fresh DBs
  gain the self-contained policy. Drizzle keys applied migrations off the journal `when` timestamp,
  not a re-hash, so editing an already-applied migration does not re-run it.

- **C-07 — dependency CVEs** (root `package.json` `overrides`, `bun.lock`).
  Added `overrides` pinning the prod-runtime deps the audit flagged:
  - `follow-redirects` → `1.16.1` (was `1.16.0`, pulled by `razorpay`; two HIGH credential-header
    leak advisories GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c).
  - `undici` → `8.12.3`. **Changed from the `7.30.1` pin this branch carried off `main`** when it
    was merged into `dev`. `dev` had since added `jsdom@30.1.2` (admin component-test env,
    `// @vitest-environment jsdom`) which requires `undici ^8.11.2`, hoisting undici to the 8.x line;
    the live advisory moved with it to **`>=8.0.0 <8.12.2`** (up to HIGH — content-encoding DoS,
    GHSA-xjj6-f33q-929c; EventSource DoS GHSA-4qv8-2p9j-2685; SRI bypass GHSA-f72v-6w45-q472),
    hitting prod consumers `ai` / `@ai-sdk/gateway` / `mjml` via the hoisted `8.11.2`. `8.12.3` is the
    fixed release and **satisfies `jsdom`'s `^8.11.2`**, so the override clears the advisory without
    breaking the admin test env. Bun has no nested/scoped overrides (it warns and ignores them), so a
    global pin was the only lever; it force-upgrades the few remaining `^7`/`^6` nested consumers
    (`@ai-sdk/provider-utils`, `cheerio`, `juice/cheerio`, `shadcn`, `miniflare`) to `8.12.3` — low
    risk (the `@ai-sdk` siblings already ran on undici 8 in this tree; `cheerio`'s undici is a
    `fromURL` cold path `juice` never calls). `@commerce/core` + `@commerce/ai` typecheck clean on it.

  `bun audit` no longer lists `undici` or `follow-redirects`. The remaining audit hits (katex/mermaid
  in `@commerce/docs`, esbuild in `drizzle-kit`, etc.) are **docs- or build-tooling only**, not shipped
  in the storefront/admin runtime — out of scope here, left for a separate dependency-maintenance pass.

## Verified

`bun run lint` (biome) on the changed files — clean. `turbo run typecheck --filter=@commerce/core`
— pass (incl. the C-02 payment changes). C-01 token logic proven via a standalone round-trip +
domain-separation check; C-02's behaviour is covered by the existing `webhook.test.ts` underpayment
case. The DB-backed suites could not run locally (Docker Postgres unreachable on `localhost:5432`
from this shell — a known local-env issue) and run in CI. `bun audit` re-run confirms C-07.

## Resolved without a code change

### C-04 — marketing open-pixel replay: not a real exposure
The finding's premise is that replaying an open pixel inflates open analytics. It does not:
`recordMessageOpen` (`packages/core/src/marketing/tracking.ts`) is **first-open-wins** — it sets
`marketingMessage.openedAt` only `WHERE openedAt IS NULL`, with **no per-open counter**. A replayed
(or image-proxy-prefetched) pixel is already a no-op; there is nothing to inflate. Adding a timestamp
to the token (which is **shared** with `clickToken`) would invalidate in-flight tokens and complicate
the format to defend against an input the data model already neutralises. Unsubscribe replay is
idempotent and List-Unsubscribe links must stay valid indefinitely. **No change made; the existing
`openedAt IS NULL` guard is the replay protection, already documented in `tracking.ts`.** If per-open
*event* analytics are ever added (a counter), revisit then.

## Sequenced to the EC2→Lightsail migration (ops, not code)

### I-07 — crown secrets in flat env
The app reads all secrets from `process.env` via `loadEnv`/`settingsSecret` (zod-validated,
fail-fast, with `SETTINGS_SECRET_PREVIOUS` rotation). I-07 is about **where those env vars come
from**, not app logic, so there is no safe code-only fix and the `SETTINGS_SECRET` decrypt path must
not be touched blind on launch eve. Verified hygiene (25 Oct): **no secret value in any committed
file** — `.env` gitignored and untracked, only empty placeholders in `.env.example` /
`deploy/env.production.example`; values live in Dokploy's env config. Residual risk is an env dump by
someone with Dokploy/SSH access, now 2FA-gated (CP-01/CP-02) with origin ports moving behind the
tunnel → **Low**. The move to AWS Secrets Manager (instance-role read, entrypoint injection that is a
no-op until `AWS_SECRETS_MANAGER_SECRET_ID` is set, then rotate `SETTINGS_SECRET`) is written up step
by step as **section F of `docs/security/secret-rotation-runbook.md`** and is executed during the
Lightsail cutover, when secrets are provisioned fresh on the new box regardless.

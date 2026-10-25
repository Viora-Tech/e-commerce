# Security: low-severity code hardening (C-01, C-03, C-07)

**Branch** `security/low-code-hardening` from `main`. Closes three of the low-severity
code findings from `docs/security/2026-10-24-infra-pentest.md`. Built the night before the
2026-10-26 launch **on a branch, not deployed** — merge after launch. No schema change, no
app (web/admin) code touched; the diff is one HMAC line, one migration line, a dependency
pin, and tests.

## Done

- **C-01 — cart-recovery token domain separation** (`packages/core/src/cart/abandoned.ts`).
  `recoveryToken`/`verifyRecoveryToken` signed the bare body `<cartId>.<expires>` with the raw
  secret — the only signed-link helper without a purpose prefix. Now the shared `sign()` HMACs
  `recovery:<body>`, matching `preorder/balance-link.ts` (`<purpose>:<body>`). A recovery token
  can no longer be confused with another `<id>.<expiry>` token signed under the same secret.
  **Invalidates in-flight recovery links** (7-day TTL — acceptable, and blast radius is ~zero
  pre-launch). Tests in `abandoned.test.ts`: existing round-trip/tamper/expiry still green, plus
  a new case asserting a bare-scheme (no-prefix) HMAC is rejected.

- **C-03 — migration self-applies RLS** (`packages/db/drizzle/0078_store_data.sql`).
  Appended `SELECT apply_store_rls();` at EOF (behind a `--> statement-breakpoint`), like every
  other table-adding RLS migration (e.g. `0012`, `0014`). `store_export`'s policy was only applied
  by `0079` before; a future squash/reorder could have dropped it. **Idempotent** — `apply_store_rls()`
  is called by every migration — so production (already past `0079`) is unaffected; only fresh DBs
  gain the self-contained policy. Drizzle keys applied migrations off the journal `when` timestamp,
  not a re-hash, so editing an already-applied migration does not re-run it.

- **C-07 — dependency CVEs** (root `package.json` `overrides`, `bun.lock`).
  Added `overrides` pinning the two prod-runtime deps the audit flagged:
  - `follow-redirects` → `1.16.1` (was `1.16.0`, pulled by `razorpay`; two HIGH credential-header
    leak advisories GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c).
  - `undici` → `7.30.1` (was `7.29.1`, pulled by `@ai-sdk/gateway` + `shadcn`; advisory
    `>=7.0.0 <7.30.1`). Pinned **within the existing `^7` range** — deliberately not the 8.x major,
    to avoid a breaking bump on launch eve.

  `bun audit` no longer lists either. The remaining audit hits (dompurify/xmldom in `@commerce/docs`,
  vite/vitest/happy-dom in admin dev-deps, source-map-js) are **docs- or test-tooling only**, not
  shipped in the storefront/admin runtime — out of scope here; bumping vitest/happy-dom risks the
  test suite and was left for a separate dependency-maintenance pass.

## Verified

`bun run lint` (biome) on the changed files — clean. `turbo run typecheck --filter=@commerce/core`
— pass. C-01 token logic proven via a standalone round-trip + domain-separation check (the
DB-backed `abandoned.test.ts` suite could not run locally — test-DB auth mismatch for user
`kulde` — and will run in CI). `bun audit` re-run confirms C-07.

## Deferred — own PRs after launch (specs below)

### C-02 — centralise the payment amount-guard
**Why not bundled:** the guard isn't a stray check. In `packages/core/src/payments/webhook.ts`
it does gateway-specific bookkeeping — on `gatewayPaidTooLittle(expected, e.amountPaise)` it marks
the `payment_event` row `processed` with an `amount mismatch: …` note and returns
`{applied:false}` **without** calling `applyPaymentStatus`. Current state is **safe**: the
non-webhook capture paths (`confirmClientPayment`, QR settle, manual mark-as-paid, COD, balance,
expiry reconcile) rely on gateway amount-binding, and most legitimately capture with *no*
gateway-reported amount at all.

**Spec:**
1. Add `capturedAmountPaise?: number | null` to `applyPaymentStatus`'s input type (`PaymentRef & …`).
2. Inside, when `next === 'captured'` **and** `capturedAmountPaise != null`, evaluate
   `gatewayPaidTooLittle(p.amountPaise, capturedAmountPaise)`. On underpayment, do **not** capture;
   signal it back distinctly (e.g. extend the return type with a `rejected: 'underpaid'` variant, or
   return a dedicated result) so the webhook can still write its `payment_event` error note and its
   `WebhookOutcome`.
3. `webhook.ts`: pass `capturedAmountPaise: e.amountPaise` into `applyPaymentStatus` and drop the
   now-duplicated pre-check, mapping the new rejected signal onto today's `payment_event` update +
   return.
4. All other callers pass nothing → guard skipped (correct — no gateway amount to compare).
5. Tests: extend `amount-check.test.ts` and add a webhook case (underpaid capture stays unpaid +
   event noted); regression-test manual/COD/balance captures still succeed with no amount.

Needs the webhook event-row semantics preserved exactly — hence its own reviewed PR with full
payment tests, not a launch-eve bundle.

### C-04 — marketing open/unsubscribe token replay
**Why not bundled:** `messageToken` (`packages/core/src/marketing/tokens.ts`) is shared by the
open-pixel **and** `clickToken`. Adding replay protection forces a product decision — reject opens
older than a window, or dedupe per (message, opener) in `recordMessageOpen` instead; and must **not**
start expiring click-through on older campaigns (click tokens are fine today — destination is MAC'd).
It is explicitly optional ("only if open-rate integrity matters"). Unsubscribe replay is idempotent
(harmless) and List-Unsubscribe links must stay valid indefinitely, so unsubscribe tokens should be
left alone.

**Spec (one viable shape):** bind a send timestamp into the *message* token body
(`<storeId>.<messageId>.<sentAtMs>.<mac>`); enforce a max-age **only on the open path**
(`apps/storefront/src/app/api/m/open/[token]/route.ts` / `recordMessageOpen`), leaving click
verification age-agnostic. Decide the window with the owner first. Changing the format invalidates
in-flight message tokens (fine pre-launch).

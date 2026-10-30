# Security: better-auth account-takeover fix + SCA release gate

A `bun audit` run (part of owner-authorized security testing, 30 Oct) surfaced two **direct**
dependency advisories that the manual Sept/Oct code + infra audits could not catch — a
point-in-time review doesn't run SCA, and the advisories were published after it.

## Fixes
- **better-auth `1.7.6 → 1.7.14`** (+ `@better-auth/passkey`) in `@commerce/auth`, `@commerce/core`,
  `@commerce/admin`. Closes GHSA-965c-763c-88jm (critical: OAuth state reused as a magic link to
  sign in as another user) and GHSA-r4xp-prcw-77qf (high: OAuth proxy sign-in as another user).
  Google social sign-in is live, so this was account-takeover on the money path.
- **zod `→ 4.6.7`** (floor raised to `^4.6.7` across all 18 manifests that declare it). Closes
  GHSA-mrhx-c7xc-m3w5 (high: memory-exhaustion DoS validating oversized constrained collections,
  `<4.6.6`). zod validates untrusted API request bodies everywhere.

## New: dependency release gate
- `scripts/security-audit.ts` + `bun run audit`, documented as a pre-release local gate in the
  Release checklist. It parses `bun audit --json` and **fails only when a high/critical advisory's
  vulnerable range can still be reached by the version floor we declare** — a genuine direct
  exposure. Transitive copies (e.g. the `shadcn` CLI chain, dev tooling) and advisories our floor
  already excludes print as warnings. An `ALLOW` map triages accepted advisories by id, with a
  reason. This turns point-in-time auditing into a per-release check.

## Verification
- `bun run audit` → exit 0 (green); 11 remaining high/criticals are transitive/dev-only warnings.
- `@commerce/auth` tests 30/30 (incl. OAuth/account-linking + a new session-attack suite); typecheck clean.
- `@commerce/core` business-logic suites 58/58 (webhook, cart, place-order, discounts) under zod 4.6.7.

## Also added
- `packages/auth/test/session-attacks.test.ts` — owner-authorized attack simulation for session
  replay/fixation/OTP (documents which controls hold and which are gaps).
- `docs/security/2026-10-30-app-attack-catalog.md` — full app attack catalog + what was tested.

## Deferred (not launch-critical, tracked in the catalog)
`shadcn` → devDependencies (drops its transitive high-sev chain off the prod surface), `sanitize-html`
bump, and the docs-only `dompurify`/mermaid. Session hardening gaps A1 (device/session binding) and
A5 (step-up re-auth for sensitive actions) are noted as Medium follow-ups.

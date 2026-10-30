# Security A5 (task 2/4): step-up re-auth verification core

Second task of step-up re-authentication (attack-catalog A5). Pure server core in `@commerce/auth`
— **nothing calls it yet**, so it changes no behavior and is safe to merge on its own, like the
task-1 column.

## What it is
An already-signed-in merchant re-verifies with an OTP or a passkey before a sensitive action; a
success stamps the SAME session's `reauthenticated_at = now()`. No new session is minted.

## Change
- `packages/auth/src/step-up.ts` (new), exports:
  - `markReauthenticated(db, {sessionId, userId})` — stamps the session, scoped to id **and**
    userId so a session can only bump its own row.
  - `createStepUpOtp(db, userId)` / `verifyStepUpOtp(db, {sessionId, userId, otp})` — a six-digit
    code kept server-side in the `verification` table as a SHA-256 hash, under a dedicated
    `step-up-otp:` namespace, consume-once, 5-attempt cap. **Not** Better Auth's email-OTP: its
    `type` is a fixed union and `email-verification` already belongs to account deletion, so a
    custom namespaced code avoids collision and conflation.
  - `stepUpPasskeyOptions(db, {sessionId, userId, rpId})` / `verifyStepUpPasskey(db, {...response})`
    — our own WebAuthn ceremony on `@simplewebauthn/server` (the library `@better-auth/passkey` is
    built on). We can't use the plugin's verify: it always mints a fresh session. User verification
    required; challenge kept server-side keyed to the session (`step-up-passkey:`), consume-once,
    rpID-bound; reads the plugin's stored credentials (`publicKey` = standard base64, `transports`
    = CSV).
  - `stepUpAgeMs` / `isFresh` / `STEP_UP_WINDOW_MS` — the 10-minute freshness the task-3 guard
    gates sensitive actions on.
- `packages/auth/package.json`: adds `@simplewebauthn/server@13.3.3` (pinned, already in the lockfile).

## Why custom verification (not the Better Auth endpoints)
`verifyPasskeyAuthentication` and `signInEmailOTP` both mint/rotate a session. Step-up must leave
the current session in place and only refresh its freshness stamp, so both factors are verified by
our own code against the credentials/verification rows Better Auth owns.

## Verification
- `packages/auth/test/step-up.test.ts` (new): drives the core against the real merchant auth + a
  real session row (`verifyAuthenticationResponse` stubbed exactly as the shopper passkey tests do;
  the challenge plumbing — storage, single-use, expiry, rpID binding — is tested for real). Covers:
  session stamping + scope, OTP verify/replay/attempt-cap, passkey verify/replay/expiry/rpID
  mismatch, freshness window.
- `bun run --filter @commerce/auth test` → **37/37 pass**; `typecheck` clean.
- TDD note: the first red run was blocked by a local Postgres outage (box was recovering), so the
  module was written before a clean red was observed; the suite's negative cases (wrong OTP never
  stamps, replay rejected, expired/rpID-mismatch rejected, wrong-user never bumps) do discriminate
  correct from incorrect behaviour.

## Next tasks
3. orpc `reauth` router (sendOtp / passkeyOptions / verify) **and** a guard that requires freshness
   for `kindForInput(path,input) === 'sensitive'` calls, behind an off-by-default flag; 4. admin
   re-auth dialog + flag-on (needs a cloud build).

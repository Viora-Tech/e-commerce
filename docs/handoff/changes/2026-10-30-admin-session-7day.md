# Security A1: shorten admin session to 7-day sliding window

The merchant (admin) session was a **30-day** sliding window. Since the session cookie is
bearer-only (no device binding yet — attack-catalog finding A1), a cloned cookie authenticates
from anywhere for as long as the session lives. Shortening it bounds that window.

## Change
- `packages/auth/src/merchant.ts`: `session.expiresIn` `60*60*24*30` → `60*60*24*7` (7 days).
  `updateAge` stays `1 day`, so an active admin's session still refreshes on use — they are not
  logged out weekly; only an idle (unused > 7 days) session expires.

## Verification
- `@commerce/auth` suite **30/30** (sign-in, OTP, passkey, Google, session-attack suite) — the
  config change breaks nothing.

## Follow-up (not in this PR)
A5 — step-up re-auth for sensitive actions (fresh OTP/passkey within 10 min before payment keys,
staff/roles, payouts, deletes, domains). Larger feature: session `reauthenticated_at` column +
migration, a custom step-up verify flow, a guard middleware keyed off the existing `classifyAction`
`sensitive` set (behind an off-by-default flag), and an admin re-auth dialog. To be built server-core
first (flag off, safe to merge), then UI + flag-on.

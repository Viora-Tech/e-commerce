# Security A5 (task 1/4): session.reauthenticated_at column

First task of the step-up re-auth feature (attack-catalog A5). Schema-only and additive — **no
code reads this column yet**, so it changes no behavior and is safe to merge on its own.

## Change
- `packages/db/src/auth-schema.ts`: `session.reauthenticatedAt timestamp (tz) NOT NULL DEFAULT now()`.
- Migration `drizzle/0192_session_reauth.sql`:
  1. `ADD COLUMN reauthenticated_at` (nullable);
  2. backfill `= created_at` for existing rows (their real sign-in time — an old/stolen session
     is therefore already "stale" once the guard ships, not handed a fresh stamp);
  3. `SET DEFAULT now()` (a fresh sign-in is itself a recent verification);
  4. `SET NOT NULL`.
  (drizzle-kit emitted `0176_unusual_william_stryker` by its internal index; renamed to the repo's
  sequential convention `0192_session_reauth` and the journal tag updated to match.)

## Why default now()
Better Auth inserts session rows and doesn't know this column, so the DB default stamps every new
session at creation → a just-logged-in admin is never immediately prompted to re-verify.

## Verification
- Harness migrated the test DBs and `@commerce/db` rls-isolation **4/4** passed.
- `information_schema`: column present, `is_nullable = NO`, `default = now()` on template + worker DBs.
- Migration applied with no NOT-NULL violation → the backfill ran before `SET NOT NULL`.

## Next tasks
2. step-up verify flow (OTP + passkey) that bumps `reauthenticated_at`; 3. guard middleware on the
`sensitive` action set (behind an off-by-default flag); 4. admin re-auth dialog + flag-on.

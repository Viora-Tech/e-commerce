/**
 * SOURCE OF TRUTH KEYWORDS: isUniqueViolation, 23505, unique_violation
 * WHAT:  True when a thrown error is a Postgres unique violation (SQLSTATE 23505).
 * WHY:   Drizzle/postgres.js wrap the driver error in `cause` (sometimes twice), so a bare
 *        `err.code === '23505'` misses it. One walker instead of a copy per service.
 * WHERE: Core services that turn a duplicate-key race into a friendly answer (domains,
 *        onboarding, sender email); guarded by the duplicate-helpers sweep.
 */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err
  for (let i = 0; i < 3 && e; i++) {
    if ((e as { code?: unknown }).code === '23505') return true
    e = (e as { cause?: unknown }).cause
  }
  return false
}

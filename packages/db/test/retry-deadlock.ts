/**
 * Run a DDL statement from a test (a migration replayed, a constraint dropped), retrying
 * when Postgres picks it as the victim of a deadlock with autovacuum's ANALYZE (40P01).
 * The test databases see heavy row churn (`resetDb` deletes before every test), so
 * autovacuum visits them mid-run; a deadlocked statement is rolled back whole, so running
 * it again is safe.
 */
export async function retryOnDeadlock<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= attempts || !isDeadlock(error)) throw error
    }
  }
}

function isDeadlock(error: unknown): boolean {
  let current: unknown = error
  // drizzle wraps the driver's error in `cause`.
  for (let depth = 0; current && depth < 3; depth++) {
    if ((current as { code?: string }).code === '40P01') return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

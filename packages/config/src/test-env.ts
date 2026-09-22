import { config } from 'dotenv'

/**
 * Load `.env.test` and point the database URLs at `commerce_test_<suffix>`.
 * Each test package gets its own database so suites can run in parallel.
 *
 * Set `TEST_DB_NAMESPACE` (letters, digits, underscores) to isolate a whole
 * checkout: every package then uses `commerce_test_<namespace>_<suffix>`, which
 * the global setup creates on first use. Parallel worktrees each set their own
 * namespace so one checkout's reset never truncates another's run.
 */
export function loadTestEnv(suffix: string, envFile: string): void {
  config({ path: envFile })
  const namespace = testDbNamespace()
  const name = namespace ? `${namespace}_${suffix}` : suffix
  for (const key of ['DATABASE_URL', 'DATABASE_URL_OWNER'] as const) {
    const url = process.env[key]
    if (url) process.env[key] = url.replace(/\/commerce_test$/, `/commerce_test_${name}`)
  }
}

function testDbNamespace(): string | null {
  const raw = process.env.TEST_DB_NAMESPACE?.trim()
  if (!raw) return null
  if (!/^[a-z0-9_]{1,32}$/i.test(raw)) {
    throw new Error('TEST_DB_NAMESPACE must be 1-32 letters, digits or underscores')
  }
  return raw.toLowerCase()
}

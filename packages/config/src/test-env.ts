import { config } from 'dotenv'

/**
 * Load `.env.test` and point the database URLs at `commerce_test_<suffix>`.
 * Each test package gets its own database so suites can run in parallel.
 */
export function loadTestEnv(suffix: string, envFile: string): void {
  config({ path: envFile })
  for (const key of ['DATABASE_URL', 'DATABASE_URL_OWNER'] as const) {
    const url = process.env[key]
    if (url) process.env[key] = url.replace(/\/commerce_test$/, `/commerce_test_${suffix}`)
  }
}

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

/**
 * Load `.env.test` and point the database URLs at `commerce_test_<suffix>`.
 * Each test package gets its own database so suites can run in parallel.
 *
 * Set `TEST_DB_NAMESPACE` (letters, digits, underscores) to isolate a whole
 * checkout: every package then uses `commerce_test_<namespace>_<suffix>`, which
 * the global setup creates on first use. Parallel worktrees each set their own
 * namespace so one checkout's reset never truncates another's run.
 *
 * That database is only the migrated TEMPLATE: test files run in up to
 * `TEST_WORKERS` vitest workers, each on its own copy (`<name>_w<pool id>`, see
 * `useWorkerDatabase`), so files run in parallel without truncating each other.
 */
export function loadTestEnv(suffix: string, envFile: string): void {
  // override: Bun auto-loads the repo's `.env` first; without it the dev DATABASE_URL
  // survives and the suites' resets wipe the dev database.
  config({ path: envFile, override: true, quiet: true })
  const namespace = testDbNamespace()
  const name = namespace ? `${namespace}_${suffix}` : suffix
  for (const key of ['DATABASE_URL', 'DATABASE_URL_OWNER'] as const) {
    const url = process.env[key]
    if (url) process.env[key] = url.replace(/\/commerce_test$/, `/commerce_test_${name}`)
    assertTestDatabase(key, process.env[key])
  }
}

const DEFAULT_TEST_WORKERS = 3
const MAX_TEST_WORKERS = 8

/**
 * How many test files a database-backed package runs at once: `TEST_WORKERS`
 * (1-8, default 3). Each worker gets its own database, so this also caps the
 * Postgres connections and RAM one suite uses. `TEST_WORKERS=1` runs files one
 * after another, like before.
 */
export function testWorkers(): number {
  const raw = process.env.TEST_WORKERS?.trim()
  if (!raw) return DEFAULT_TEST_WORKERS
  const workers = Number(raw)
  if (!Number.isInteger(workers) || workers < 1 || workers > MAX_TEST_WORKERS) {
    throw new Error(`TEST_WORKERS must be a whole number from 1 to ${MAX_TEST_WORKERS}`)
  }
  return workers
}

/** The vitest setup file that moves each worker onto its own database (`useWorkerDatabase`). */
const WORKER_SETUP = fileURLToPath(new URL('./test-worker.ts', import.meta.url))

/**
 * Vitest `test` options for a package whose files share a test database: run
 * `testWorkers()` files at once, each worker on its own database copy. The
 * package's `globalSetup` must call `prepareTestDatabases` from
 * `@commerce/db/test/databases` to migrate the template and clone the copies.
 */
export function parallelDbTests(): {
  fileParallelism: boolean
  maxWorkers: number
  setupFiles: string[]
} {
  const workers = testWorkers()
  return { fileParallelism: workers > 1, maxWorkers: workers, setupFiles: [WORKER_SETUP] }
}

/** `commerce_test_x` → `commerce_test_x_w2` for vitest worker 2. Idempotent. */
export function workerDatabaseUrl(url: string, poolId: number): string {
  const parsed = new URL(url)
  const base = decodeURIComponent(parsed.pathname.slice(1)).replace(/_w\d+$/, '')
  const name = `${base}_w${poolId}`
  // Postgres silently truncates longer names, which would merge the workers' databases.
  if (name.length > 63) {
    throw new Error(
      `Test database name "${name}" is over 63 characters; use a shorter TEST_DB_NAMESPACE`,
    )
  }
  parsed.pathname = `/${name}`
  return parsed.toString()
}

/**
 * Runs inside each vitest worker before every test file: points `DATABASE_URL`
 * and `DATABASE_URL_OWNER` at this worker's database copy and gives it its own
 * local-storage folder, so parallel files never share rows or uploaded files.
 */
export function useWorkerDatabase(): void {
  const poolId = Number(process.env.VITEST_POOL_ID ?? '1')
  for (const key of ['DATABASE_URL', 'DATABASE_URL_OWNER'] as const) {
    const url = process.env[key]
    if (!url) continue
    process.env[key] = workerDatabaseUrl(url, poolId)
    assertTestDatabase(key, process.env[key])
  }
  const owner = process.env.DATABASE_URL_OWNER
  if (owner && !process.env.LOCAL_STORAGE_DIR?.trim()) {
    const db = new URL(owner).pathname.slice(1)
    process.env.LOCAL_STORAGE_DIR = join(tmpdir(), 'commerce-test-uploads', db)
  }
}

/** Refuse to run against anything but a `commerce_test*` database. */
function assertTestDatabase(key: string, url: string | undefined): void {
  if (!url) return
  const db = new URL(url).pathname.slice(1)
  if (!/^commerce_test(_[a-z0-9_]+)?$/.test(db)) {
    throw new Error(`${key} points at "${db}", not a commerce_test database; refusing to run tests`)
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

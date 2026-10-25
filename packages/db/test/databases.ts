import { workerDatabaseUrl } from '@commerce/config/test-env'
import postgres from 'postgres'
import { runMigrations } from '../src/migrate'

/**
 * Vitest `globalSetup` for a database-backed package (see `parallelDbTests` in
 * `@commerce/config/test-env`). Migrates the package's test database, then makes sure
 * each worker has its own copy (`<name>_w1`, `_w2`, …):
 *
 * - a missing copy is cloned from the migrated database with `CREATE DATABASE …
 *   TEMPLATE` (a block copy, a second or two, instead of replaying every migration);
 * - an existing copy is kept and migrated like the template, a no-op unless a new
 *   migration landed.
 *
 * Copies are never dropped: `DROP DATABASE` forces a Postgres checkpoint, which took
 * minutes on the shared Docker volume while other agents' suites were writing. They
 * hold no rows worth keeping (suites reset before each test), cost a few MB each,
 * and the next run reuses them.
 *
 * Only ever touches `commerce_test_*` databases (checked here and in `loadTestEnv`);
 * the dev and production databases are never involved.
 */
export async function prepareTestDatabases(workers: number): Promise<void> {
  const ownerUrl = process.env.DATABASE_URL_OWNER
  if (!ownerUrl) throw new Error('DATABASE_URL_OWNER missing; is .env.test loaded?')
  await migrateRetryingRoleRace(ownerUrl)

  const template = databaseName(ownerUrl)
  const copies = Array.from({ length: Math.max(1, workers) }, (_, i) =>
    workerDatabaseUrl(ownerUrl, i + 1),
  )
  const admin = adminConnection(ownerUrl)
  const existing = new Set<string>()
  try {
    const rows = await admin<{ datname: string; invalid: boolean }[]>`
      select datname, datconnlimit = -2 as invalid
      from pg_database where datname = any(${copies.map(databaseName)})`
    for (const { datname, invalid } of rows) {
      // Left half-dropped by an interrupted DROP DATABASE: unusable, so finish the drop.
      if (invalid) await admin.unsafe(`drop database if exists "${datname}"`)
      else existing.add(datname)
    }
    const missing = copies.map(databaseName).filter((name) => !existing.has(name))
    if (missing.length > 0) {
      // A template must have no other sessions while it is copied.
      await admin`select pg_terminate_backend(pid) from pg_stat_activity
        where datname = ${template} and pid <> pg_backend_pid()`
      for (const name of missing) {
        await admin.unsafe(`create database "${name}" template "${template}"`)
      }
    }
  } finally {
    await admin.end()
  }
  await Promise.all(
    copies.filter((url) => existing.has(databaseName(url))).map((url) => runMigrations(url)),
  )
}

function databaseName(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1))
  if (!/^commerce_test_[a-z0-9_]+$/.test(name)) {
    throw new Error(`"${name}" is not a commerce_test_* database; refusing to touch it`)
  }
  return name
}

function adminConnection(ownerUrl: string): postgres.Sql {
  const url = new URL(ownerUrl)
  url.pathname = '/postgres'
  return postgres(url.toString(), { max: 1, onnotice: () => {} })
}

/**
 * Migrations that change a role (`ALTER ROLE app SET …`, 0114) touch one catalog row shared by
 * every database. Packages set up their test databases in parallel, so two can run that
 * statement at once and Postgres fails one with "tuple concurrently updated". The migration
 * ran in a transaction and rolled back, so running it again is safe. Production migrates once.
 */
async function migrateRetryingRoleRace(ownerUrl: string, attempts = 4): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await runMigrations(ownerUrl)
      return
    } catch (err) {
      const text = `${err instanceof Error ? err.message : ''} ${String((err as { cause?: unknown })?.cause ?? '')}`
      if (i >= attempts || !text.includes('tuple concurrently updated')) throw err
      await new Promise((resolve) => setTimeout(resolve, 250 * i + Math.random() * 250))
    }
  }
}

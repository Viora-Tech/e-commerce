import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export async function runMigrations(ownerUrl: string): Promise<void> {
  await ensureTestDatabase(ownerUrl)
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} })
  try {
    const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
    await migrate(drizzle(sql), { migrationsFolder })
  } finally {
    await sql.end()
  }
}

/**
 * Creates a missing `commerce_test_*` database so namespaced test checkouts
 * (see `TEST_DB_NAMESPACE`) work on first run. Only ever touches databases whose
 * name starts with `commerce_test_`; the dev and production databases are never
 * created or altered here.
 */
async function ensureTestDatabase(ownerUrl: string): Promise<void> {
  const url = new URL(ownerUrl)
  const name = decodeURIComponent(url.pathname.slice(1))
  if (!/^commerce_test_[a-z0-9_]+$/.test(name)) return
  url.pathname = '/postgres'
  const admin = postgres(url.toString(), { max: 1, onnotice: () => {} })
  try {
    const found = await admin`select 1 from pg_database where datname = ${name}`
    if (found.length === 0) await admin.unsafe(`create database "${name}"`)
  } finally {
    await admin.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await runMigrations(url)
  console.log('migrations applied')
}

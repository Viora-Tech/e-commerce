/**
 * Creates (if missing) and migrates the local `commerce_shots` database the screenshot seed uses.
 * Migrates in chunks of 30, one transaction each: the whole history in one transaction runs out
 * of locks on a Postgres with the default `max_locks_per_transaction` (64).
 *
 *   bun --env-file=../../.env scripts/screenshots/migrate.ts        (from apps/docs)
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb } from '../../../../packages/db/src/client'
import { runMigrations } from '../../../../packages/db/src/migrate'

/** This script's folder. */
const HERE = fileURLToPath(new URL('.', import.meta.url))

const SHOTS_DB = 'commerce_shots'
const url = process.env.DATABASE_URL_OWNER
if (!url) throw new Error('DATABASE_URL_OWNER is required')
const target = new URL(url)
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== `/${SHOTS_DB}`) {
  throw new Error(`only migrates localhost/${SHOTS_DB}, not ${target.host}${target.pathname}`)
}

const admin = new URL(url)
admin.pathname = '/postgres'
const server = createDb(admin.toString()).$client
try {
  const found = await server`select 1 from pg_database where datname = ${SHOTS_DB}`
  if (found.length === 0) await server.unsafe(`create database "${SHOTS_DB}"`)
} finally {
  await server.end()
}

const source = resolve(HERE, '../../../../packages/db/drizzle')
const work = join(tmpdir(), 'commerce-shots-migrations')
const journal = JSON.parse(readFileSync(join(source, 'meta/_journal.json'), 'utf8'))
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
cpSync(source, work, { recursive: true })
for (let end = 30; ; end += 30) {
  const entries = journal.entries.slice(0, Math.min(end, journal.entries.length))
  writeFileSync(join(work, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }))
  await runMigrations(url, work)
  console.log('migrated through', entries.at(-1).tag)
  if (end >= journal.entries.length) break
}
rmSync(work, { recursive: true, force: true })

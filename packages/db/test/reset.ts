import { sql } from 'drizzle-orm'
import type { Db } from '../src/client'

/**
 * Empty every public table (the migrations journal lives in the `drizzle` schema) and
 * restart the tables' identity sequences. Owner connection only.
 *
 * Most suites call this before EVERY test, so it is on the hot path. `TRUNCATE` of all
 * ~110 tables costs ~2 s each time (new files for every table and index); a `DELETE`
 * from each, with foreign-key triggers off for the transaction (every table is emptied,
 * so nothing is left dangling), takes ~50 ms. Sequences are reset the way
 * `restart identity` did. Falls back to the old `TRUNCATE` when the owner role may not
 * switch `session_replication_role` (it needs superuser, which `.env.test` uses).
 */
export async function resetDb(ownerDb: Db): Promise<void> {
  // Never empty a dev or production database: a test run from the repo root with `.env`
  // loaded (instead of the package's `.env.test`) once wiped the local dev store.
  const [current] = await ownerDb.execute<{ name: string }>(sql`select current_database() as name`)
  if (!current?.name.startsWith('commerce_test')) {
    throw new Error(
      `resetDb refuses to empty "${current?.name}": only commerce_test_* databases. Run tests from the package (bun run --cwd packages/<pkg> test) so .env.test is loaded.`,
    )
  }
  const rows = await ownerDb.execute<{ name: string }>(sql`
    select quote_ident(tablename) as name from pg_tables where schemaname = 'public'
  `)
  const names = rows.map((r) => r.name)
  if (names.length === 0) return
  try {
    await ownerDb.$client.begin(async (tx) => {
      await tx.unsafe('set local session_replication_role = replica')
      await tx.unsafe(names.map((name) => `delete from ${name};`).join('\n'))
      await tx.unsafe(RESET_OWNED_SEQUENCES)
    })
  } catch (error) {
    if (!isPermissionError(error)) throw error
    await ownerDb.execute(sql.raw(`truncate table ${names.join(', ')} restart identity cascade`))
  }
}

/** What `restart identity` did: every sequence owned by a public table's column. */
const RESET_OWNED_SEQUENCES = `
  select setval(s.seqrelid, s.seqstart, false)
  from pg_sequence s
  join pg_depend d on d.objid = s.seqrelid
    and d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i')
  join pg_class t on t.oid = d.refobjid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'`

function isPermissionError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '42501'
}

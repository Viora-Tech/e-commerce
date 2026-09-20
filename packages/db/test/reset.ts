import { sql } from 'drizzle-orm'
import type { Db } from '../src/client'

/** Truncate every public table except the migrations journal. Owner connection only. */
export async function resetDb(ownerDb: Db): Promise<void> {
  const rows = await ownerDb.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `)
  const names = rows.map((r) => `"${r.table_name}"`).join(', ')
  if (names.length === 0) return
  await ownerDb.execute(sql.raw(`truncate table ${names} restart identity cascade`))
}

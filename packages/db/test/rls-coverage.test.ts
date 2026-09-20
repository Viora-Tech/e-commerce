import { sql } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

afterAll(async () => {
  await owner.$client.end()
})

describe('RLS coverage', () => {
  it('every table with store_id has RLS enabled, forced, and the store_isolation policy', async () => {
    const rows = await owner.execute<{
      table_name: string
      rls: boolean
      forced: boolean
      has_policy: boolean
    }>(sql`
      select c.table_name,
             cl.relrowsecurity as rls,
             cl.relforcerowsecurity as forced,
             exists (
               select 1 from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.table_name
                 and p.policyname = 'store_isolation'
             ) as has_policy
      from information_schema.columns c
      join pg_class cl on cl.relname = c.table_name
      join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
      where c.table_schema = 'public' and c.column_name = 'store_id'
      order by 1
    `)
    expect(rows.length).toBeGreaterThan(0)
    const bad = rows.filter((r) => !(r.rls && r.forced && r.has_policy)).map((r) => r.table_name)
    expect(bad, 'run select apply_store_rls() in the migration that added these').toEqual([])
  })

  it('the store table itself is isolated by id', async () => {
    const [row] = await owner.execute<{ rls: boolean; forced: boolean }>(sql`
      select relrowsecurity as rls, relforcerowsecurity as forced from pg_class where relname = 'store'
    `)
    expect(row).toEqual({ rls: true, forced: true })
  })

  it('the app role cannot bypass RLS', async () => {
    const [row] = await owner.execute<{ rolbypassrls: boolean; rolsuper: boolean }>(sql`
      select rolbypassrls, rolsuper from pg_roles where rolname = 'app'
    `)
    expect(row).toEqual({ rolbypassrls: false, rolsuper: false })
  })
})

import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { product, store } from '../src/schema'
import { withStore } from '../src/with-store'
import { resetDb } from './reset'

/*
 * Store isolation through PgBouncer in transaction mode, as production runs it: one server
 * connection serves many clients in turn, so a store set by one transaction must never be seen
 * by the next. Needs the local pooler (`docker compose --profile pooling up -d`) and
 * PGBOUNCER_PORT=6432; skipped otherwise.
 */
const port = process.env.PGBOUNCER_PORT
const pooledUrl = () => {
  const url = new URL(process.env.DATABASE_URL as string)
  url.port = port as string
  return url.toString()
}

describe.skipIf(!port)('store isolation through PgBouncer', () => {
  const owner = createDb(process.env.DATABASE_URL_OWNER as string)
  const pooled = port ? createDb(pooledUrl(), { pooled: true }) : owner

  beforeEach(async () => {
    await resetDb(owner)
  })

  afterAll(async () => {
    await owner.$client.end()
    await pooled.$client.end()
  })

  it('keeps every store to its own rows when their transactions interleave', async () => {
    const stores = await owner
      .insert(store)
      .values(Array.from({ length: 4 }, (_, i) => ({ slug: `pool-${i}`, name: `Pool ${i}` })))
      .returning()
    await owner
      .insert(product)
      .values(stores.map((s) => ({ storeId: s.id, handle: `p-${s.slug}`, title: s.slug })))

    // 200 transactions over 4 stores at once, more than the pool has server connections.
    const seen = await Promise.all(
      Array.from({ length: 200 }, (_, i) => {
        const s = stores[i % stores.length] as (typeof stores)[number]
        return withStore(pooled, s.id, async (tx) => {
          await tx.execute(sql`select pg_sleep(0.005)`)
          const rows = await tx.select({ handle: product.handle }).from(product)
          return { want: `p-${s.slug}`, got: rows.map((r) => r.handle) }
        })
      }),
    )
    for (const { want, got } of seen) expect(got).toEqual([want])
  })

  it('leaves no store behind for the next client on the same server connection', async () => {
    const [s] = await owner.insert(store).values({ slug: 'pool-x', name: 'X' }).returning()
    await owner.insert(product).values({ storeId: s?.id as string, handle: 'px', title: 'x' })
    for (let i = 0; i < 20; i++) {
      await withStore(pooled, s?.id as string, (tx) => tx.select().from(product))
      // Outside any store transaction the app role must see nothing, whichever server
      // connection PgBouncer hands this query.
      expect(await pooled.select().from(product)).toEqual([])
    }
  })
})

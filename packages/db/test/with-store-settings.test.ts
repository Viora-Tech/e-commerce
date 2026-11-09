import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { store } from '../src/schema'
import { withStore } from '../src/with-store'
import { resetDb } from './reset'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const settings = sql`select current_setting('app.store_id', true) as store,
  current_setting('app.catalog_id', true) as catalog,
  current_setting('app.actor_name', true) as actor`

describe('withStore settings', () => {
  it('sets the store, catalog and actor name for the transaction only', async () => {
    const [s] = await owner.insert(store).values({ slug: 'a', name: 'A' }).returning()
    const storeId = s?.id as string
    const catalogId = '00000000-0000-4000-8000-000000000001'
    const [inside] = await withStore(app, storeId, (tx) => tx.execute(settings), {
      catalogId,
      actorName: 'Asha',
    })
    expect(inside).toMatchObject({ store: storeId, catalog: catalogId, actor: 'Asha' })
    // A later call without them does not inherit them from a pooled connection.
    const [next] = await withStore(app, storeId, (tx) => tx.execute(settings))
    expect(next?.actor ?? '').toBe('')
    expect(next?.catalog ?? '').toBe('')
  })
})

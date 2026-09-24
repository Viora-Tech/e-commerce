import { createDb, outboxEvent, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { insertOutboxEvent } from './write'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('insertOutboxEvent', () => {
  it('is written in the caller transaction, visible once it commits', async () => {
    const storeId = await seedStore('outbox-write')
    const orderId = crypto.randomUUID()
    await withStore(app, storeId, async (tx) => {
      await insertOutboxEvent(tx, storeId, 'order.placed', { orderId })
    })
    const rows = await withStore(app, storeId, (tx) => tx.select().from(outboxEvent))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      storeId,
      type: 'order.placed',
      payload: { orderId },
      dispatchedAt: null,
      attempts: 0,
    })
  })

  it('rolls back with the state change that wrote it', async () => {
    const storeId = await seedStore('outbox-rollback')
    const orderId = crypto.randomUUID()
    await expect(
      withStore(app, storeId, async (tx) => {
        await insertOutboxEvent(tx, storeId, 'order.placed', { orderId })
        throw new Error('state change failed after the event was written')
      }),
    ).rejects.toThrow('state change failed')

    const rows = await withStore(app, storeId, (tx) => tx.select().from(outboxEvent))
    expect(rows).toHaveLength(0)
  })

  it('is only visible to the store that wrote it (RLS isolation)', async () => {
    const storeA = await seedStore('outbox-store-a')
    const storeB = await seedStore('outbox-store-b')
    await withStore(app, storeA, async (tx) => {
      await insertOutboxEvent(tx, storeA, 'order.placed', { orderId: crypto.randomUUID() })
    })
    const rowsForB = await withStore(app, storeB, (tx) => tx.select().from(outboxEvent))
    expect(rowsForB).toHaveLength(0)
    const rowsForA = await withStore(app, storeA, (tx) => tx.select().from(outboxEvent))
    expect(rowsForA).toHaveLength(1)
  })
})

// Imported orders (`order.imported_from`) still emit nothing: every
// state-changing order route calls `assertNotImported` before it can reach
// `insertOutboxEvent`, and that refusal (plus the "writes nothing" half of
// each assertion) is covered end to end in
// `packages/api/test/orders-outbox.test.ts`, against the real router.

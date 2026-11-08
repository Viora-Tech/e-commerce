/** SOURCE OF TRUTH: tests for archive-on-cancel — WHAT: `cancelOrder` archives the order when Settings → Checkout `archiveCancelled` is on, and migration 0228 backfills / WHY: every cancel path shares this one update, so one suite covers them all */
import { readFileSync } from 'node:fs'
import { createDb, order, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { setOrdersArchived } from './archive'
import { cancelOrder, changeOrderStatus } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/** A store (its Settings → Checkout preferences as given) with one open order. */
async function seed(preferences: unknown = null, slug = 'waimers') {
  const [s] = await owner.insert(store).values({ slug, name: slug, preferences }).returning()
  if (!s) throw new Error('seed')
  const [o] = await owner
    .insert(order)
    .values({ storeId: s.id, number: 1, status: 'open', subtotalPaise: 1000, totalPaise: 1000 })
    .returning()
  if (!o) throw new Error('seed')
  return { storeId: s.id, orderId: o.id }
}

function inStore<T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) {
  return withStore(app, storeId, (tx) => fn({ tx, storeId }))
}

async function row(orderId: string) {
  const [o] = await owner.select().from(order).where(eq(order.id, orderId))
  return o
}

describe('archive orders automatically when they are cancelled', () => {
  it('archives a cancelled order by default, in the same cancel', async () => {
    const t = await seed()
    const out = await inStore(t.storeId, (ctx) => cancelOrder(ctx, t.orderId))
    expect(out?.status).toBe('cancelled')
    expect(out?.archivedAt).toBeInstanceOf(Date)
    expect((await row(t.orderId))?.archivedAt).toBeInstanceOf(Date)
  })

  it('archives a staff cancel from the status menu too', async () => {
    const t = await seed({ checkout: { archiveCancelled: true } })
    await inStore(t.storeId, (ctx) => changeOrderStatus(ctx, t.orderId, 'cancelled'))
    expect((await row(t.orderId))?.archivedAt).toBeInstanceOf(Date)
  })

  it('leaves the order unarchived when the store turned the setting off', async () => {
    const t = await seed({ checkout: { archiveCancelled: false } })
    await inStore(t.storeId, (ctx) => cancelOrder(ctx, t.orderId))
    const o = await row(t.orderId)
    expect(o?.status).toBe('cancelled')
    expect(o?.archivedAt).toBeNull()
  })

  it('keeps the first archive time of an order the merchant archived earlier', async () => {
    const t = await seed()
    const earlier = new Date('2026-11-01T10:00:00Z')
    await owner.update(order).set({ archivedAt: earlier }).where(eq(order.id, t.orderId))
    await inStore(t.storeId, (ctx) => cancelOrder(ctx, t.orderId))
    expect((await row(t.orderId))?.archivedAt?.toISOString()).toBe(earlier.toISOString())
  })

  it('can still be unarchived, and a repeated cancel does not archive it again', async () => {
    const t = await seed()
    await inStore(t.storeId, (ctx) => cancelOrder(ctx, t.orderId))
    const undo = await inStore(t.storeId, (ctx) => setOrdersArchived(ctx, [t.orderId], false))
    expect(undo).toEqual({ updated: 1, skipped: 0 })
    await inStore(t.storeId, (ctx) => cancelOrder(ctx, t.orderId))
    const o = await row(t.orderId)
    expect(o?.status).toBe('cancelled')
    expect(o?.archivedAt).toBeNull()
  })
})

describe('migration 0228: archive the cancelled orders already there', () => {
  const migration = readFileSync(
    new URL('../../../db/drizzle/0228_archive_cancelled_orders.sql', import.meta.url),
    'utf8',
  )

  it('archives cancelled orders in stores that keep the setting on, and nothing else', async () => {
    const on = await seed(null, 'on')
    const off = await seed({ checkout: { archiveCancelled: false } }, 'off')
    const [stillOpen] = await owner
      .insert(order)
      .values({ storeId: on.storeId, number: 2, status: 'open', subtotalPaise: 1, totalPaise: 1 })
      .returning()
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, on.orderId))
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, off.orderId))
    await owner.execute(sql.raw(migration))
    expect((await row(on.orderId))?.archivedAt).toBeInstanceOf(Date)
    expect((await row(off.orderId))?.archivedAt).toBeNull()
    expect((await row(stillOpen?.id as string))?.archivedAt).toBeNull()
  })
})

/** SOURCE OF TRUTH: test order purge — WHAT covers `notTestOrder`, `countTestOrders` and `deleteTestOrders` / WHY "Delete test orders" must remove only this store's `is_test` orders with their dependent rows and never touch a real order */
import {
  createDb,
  discount,
  discountUsage,
  inventoryLevel,
  notification,
  order,
  orderLine,
  orderNote,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { countTestOrders, deleteTestOrders, notTestOrder } from './test-orders'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 1000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 10 })
  return { storeId: s.id, variantId: v.id }
}

async function seedOrder(
  storeId: string,
  variantId: string,
  number: number,
  opts: { isTest: boolean; status?: 'open' | 'cancelled' },
) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number,
      subtotalPaise: 1000,
      totalPaise: 1000,
      isTest: opts.isTest,
      status: opts.status ?? 'open',
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner
    .insert(orderLine)
    .values({ storeId, orderId: o.id, variantId, quantity: 1, unitPricePaise: 1000 })
  await owner.insert(payment).values({
    storeId,
    orderId: o.id,
    provider: 'razorpay',
    providerRef: `ref_${number}_${storeId}`,
    status: 'captured',
    amountPaise: 1000,
  })
  await owner.insert(orderNote).values({ storeId, orderId: o.id, body: 'note', author: 'Staff' })
  return o.id
}

describe('test orders', () => {
  it('deletes only this store’s test orders and their rows, and gives the discount use back', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const real = await seedOrder(a.storeId, a.variantId, 1, { isTest: false })
    const testOpen = await seedOrder(a.storeId, a.variantId, 2, { isTest: true })
    const testCancelled = await seedOrder(a.storeId, a.variantId, 3, {
      isTest: true,
      status: 'cancelled',
    })
    const otherStoreTest = await seedOrder(b.storeId, b.variantId, 1, { isTest: true })
    await owner.insert(notification).values({
      storeId: a.storeId,
      orderId: testOpen,
      channel: 'email',
      template: 'order_confirmation',
      to: 'a@example.in',
      status: 'sent',
    })
    const [d] = await owner
      .insert(discount)
      .values({
        storeId: a.storeId,
        code: 'TEST10',
        title: 'Test 10',
        method: 'percent',
        value: 1000,
        usedCount: 2,
      })
      .returning()
    if (!d) throw new Error('seed')
    await owner.insert(discountUsage).values([
      { storeId: a.storeId, discountId: d.id, orderId: testOpen, amountPaise: 100 },
      { storeId: a.storeId, discountId: d.id, orderId: real, amountPaise: 100 },
    ])

    expect(
      await withStore(app, a.storeId, (tx) => countTestOrders({ storeId: a.storeId, tx })),
    ).toBe(2)

    const deleted = await withStore(app, a.storeId, (tx) =>
      deleteTestOrders({ storeId: a.storeId, tx }),
    )
    expect(deleted).toBe(2)

    const left = await owner.select({ id: order.id }).from(order)
    expect(left.map((o) => o.id).sort()).toEqual([real, otherStoreTest].sort())
    for (const gone of [testOpen, testCancelled]) {
      expect(await owner.select().from(orderLine).where(eq(orderLine.orderId, gone))).toEqual([])
      expect(await owner.select().from(payment).where(eq(payment.orderId, gone))).toEqual([])
      expect(await owner.select().from(orderNote).where(eq(orderNote.orderId, gone))).toEqual([])
    }
    // The real order keeps everything.
    expect(await owner.select().from(orderLine).where(eq(orderLine.orderId, real))).toHaveLength(1)
    expect(await owner.select().from(payment).where(eq(payment.orderId, real))).toHaveLength(1)
    expect(
      await owner.select().from(discountUsage).where(eq(discountUsage.orderId, real)),
    ).toHaveLength(1)
    const [after] = await owner.select().from(discount).where(eq(discount.id, d.id))
    expect(after?.usedCount).toBe(1)

    // Nothing left to delete; a second run is a no-op.
    expect(
      await withStore(app, a.storeId, (tx) => deleteTestOrders({ storeId: a.storeId, tx })),
    ).toBe(0)
  })

  it('notTestOrder leaves test orders out of a query', async () => {
    const a = await seedStore('a')
    const real = await seedOrder(a.storeId, a.variantId, 1, { isTest: false })
    await seedOrder(a.storeId, a.variantId, 2, { isTest: true })
    const rows = await withStore(app, a.storeId, (tx) =>
      tx.select({ id: order.id }).from(order).where(notTestOrder),
    )
    expect(rows.map((r) => r.id)).toEqual([real])
  })
})

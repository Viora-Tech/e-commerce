import { createDb, order, orderLine, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { gstAppBar } from '../src/app-bar'
import { enqueueOrder, issueDrafts } from '../src/queue'
import { queuePage } from '../src/queue-status'

/*
 * The sidebar's "Queue N" (the app bar's page count) and the Queue page must agree: the badge
 * counts with the page's own conditions (owner, 26 Nov 2026: "Queue 9" over a shorter list).
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: `Test ${slug}`,
      gstin: '06AAPFU0939F1ZZ',
      address: { line1: '1 Test Road', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'mat', title: 'Test mat', hsCode: '392690' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'M', sku: 'MAT-M', pricePaise: 50_000 })
    .returning()
  return { storeId, variantId: v?.id as string }
}

async function seedOrder(storeId: string, variantId: string, n: number) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: n,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      paymentMethod: 'razorpay',
      subtotalPaise: 50_000,
      totalPaise: 50_000,
      email: 'buyer@example.com',
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId,
    title: 'Test mat',
    variantTitle: 'M',
    quantity: 1,
    unitPricePaise: 50_000,
    gstRatePercent: 18,
  })
  return o?.id as string
}

describe('Queue count in the sidebar', () => {
  beforeEach(async () => {
    await resetDb(owner)
  })

  const read = (storeId: string) =>
    withStore(app, storeId, async (tx) => ({
      badge: (await gstAppBar({ tx, storeId, can: () => true })).pageCounts?.[''] ?? 0,
      list: (await queuePage(tx, storeId, { page: 1, perPage: 200 })).total,
    }))

  it('matches the Queue list, without cancelled orders, other stores, or issued drafts', async () => {
    const { storeId, variantId } = await seedStore('count-a')
    const other = await seedStore('count-b')
    const ids = [] as string[]
    for (const n of [1001, 1002, 1003, 1004]) ids.push(await seedOrder(storeId, variantId, n))
    const otherOrder = await seedOrder(other.storeId, other.variantId, 2001)
    const drafts = [] as string[]
    for (const id of ids) {
      const q = await withStore(app, storeId, (tx) => enqueueOrder(tx, storeId, id, 'manual'))
      drafts.push(q?.row.id as string)
    }
    await withStore(app, other.storeId, (tx) =>
      enqueueOrder(tx, other.storeId, otherOrder, 'manual'),
    )
    expect(await read(storeId)).toEqual({ badge: 4, list: 4 })

    // An order cancelled after it was queued leaves the queue and the count together.
    await owner
      .update(order)
      .set({ status: 'cancelled' })
      .where(eq(order.id, ids[0] as string))
    expect(await read(storeId)).toEqual({ badge: 3, list: 3 })

    // Issuing takes the invoice out of both.
    await withStore(app, storeId, (tx) =>
      issueDrafts(tx, storeId, [{ id: drafts[1] as string, invoiceDate: new Date() }], {
        commit: true,
      }),
    )
    expect(await read(storeId)).toEqual({ badge: 2, list: 2 })
    expect(await read(other.storeId)).toEqual({ badge: 1, list: 1 })
  })

  it('shows no count to a member who cannot read orders', async () => {
    const { storeId, variantId } = await seedStore('count-c')
    const id = await seedOrder(storeId, variantId, 1)
    await withStore(app, storeId, (tx) => enqueueOrder(tx, storeId, id, 'manual'))
    const bar = await withStore(app, storeId, (tx) =>
      gstAppBar({ tx, storeId, can: (p) => p !== 'orders.read' }),
    )
    expect(bar.pageCounts).toEqual({})
  })
})

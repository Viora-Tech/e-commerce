import { createDb, order, payment, refund, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { orderBalance } from '../src/services/order-fulfil.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seed(paymentStatus: 'captured' | 'refunded', refundedPaise: number) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  const storeId = s?.id as string
  const [o] = await owner
    .insert(order)
    .values({ storeId, number: 2371, status: 'cancelled', subtotalPaise: 100, totalPaise: 100 })
    .returning()
  const orderId = o?.id as string
  const [p] = await owner
    .insert(payment)
    .values({
      storeId,
      orderId,
      provider: 'razorpay',
      providerRef: 'order_1',
      status: paymentStatus,
      amountPaise: 100,
    })
    .returning()
  if (refundedPaise > 0) {
    await owner.insert(refund).values({
      storeId,
      orderId,
      paymentId: p?.id as string,
      amountPaise: refundedPaise,
      status: 'manual',
    })
  }
  return { storeId, orderId }
}

describe('orderBalance', () => {
  it('owes nothing once a payment taken in full is refunded in full (#2371)', async () => {
    const { storeId, orderId } = await seed('refunded', 100)
    const b = await withStore(app, storeId, (tx) => orderBalance(tx, storeId, orderId, 100))
    expect(b).toEqual({ capturedPaise: 100, pendingPaise: 0, refundedPaise: 100, balancePaise: 0 })
  })

  it('still owes the total when nothing was taken', async () => {
    const [s] = await owner.insert(store).values({ slug: 'x', name: 'X' }).returning()
    const storeId = s?.id as string
    const [o] = await owner
      .insert(order)
      .values({ storeId, number: 1, status: 'open', subtotalPaise: 100, totalPaise: 100 })
      .returning()
    const b = await withStore(app, storeId, (tx) => orderBalance(tx, storeId, o?.id as string, 100))
    expect(b.balancePaise).toBe(100)
  })

  it('owes nothing on a paid order', async () => {
    const { storeId, orderId } = await seed('captured', 0)
    const b = await withStore(app, storeId, (tx) => orderBalance(tx, storeId, orderId, 100))
    expect(b.balancePaise).toBe(0)
  })
})

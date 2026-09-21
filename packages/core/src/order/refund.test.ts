import { createDb, order, payment, refund, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { FakePaymentProvider } from '../providers/payment'
import { RefundNotAllowed, refundedPaise, refundPayment } from './refund'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seed(provider: string, status: 'captured' | 'pending' = 'captured') {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [o] = await owner
    .insert(order)
    .values({ storeId: s.id, number: 1, subtotalPaise: 100000, totalPaise: 100000 })
    .returning()
  if (!o) throw new Error('seed')
  const [p] = await owner
    .insert(payment)
    .values({
      storeId: s.id,
      orderId: o.id,
      provider,
      providerRef: 'ref_1',
      providerPaymentId: provider === 'cod' ? null : 'pay_1',
      status,
      amountPaise: 100000,
    })
    .returning()
  if (!p) throw new Error('seed')
  return { storeId: s.id, paymentId: p.id }
}

describe('refundPayment', () => {
  it('asks the gateway, records the refund and keeps the payment captured while money remains', async () => {
    const { storeId, paymentId } = await seed('fake')
    const gateway = new FakePaymentProvider()
    const row = await withStore(app, storeId, (tx) =>
      refundPayment({ tx, storeId }, gateway, { paymentId, amountPaise: 40000, reason: 'damaged' }),
    )
    expect(row?.status).toBe('processed')
    expect(row?.providerRefundId).toBe('rf_pay_1')
    expect(gateway.calls).toEqual(['refund:pay_1:40000'])
    const [p] = await owner.select().from(payment).where(eq(payment.id, paymentId))
    expect(p?.status).toBe('captured')
    expect(await withStore(app, storeId, (tx) => refundedPaise({ tx, storeId }, paymentId))).toBe(
      40000,
    )
  })

  it('flips the payment to refunded once the full capture is returned', async () => {
    const { storeId, paymentId } = await seed('fake')
    const gateway = new FakePaymentProvider()
    await withStore(app, storeId, async (tx) => {
      await refundPayment({ tx, storeId }, gateway, { paymentId, amountPaise: 60000 })
      await refundPayment({ tx, storeId }, gateway, { paymentId, amountPaise: 40000 })
    })
    const [p] = await owner.select().from(payment).where(eq(payment.id, paymentId))
    expect(p?.status).toBe('refunded')
    const rows = await owner.select().from(refund).where(eq(refund.paymentId, paymentId))
    expect(rows).toHaveLength(2)
  })

  it('refuses more than what is left', async () => {
    const { storeId, paymentId } = await seed('fake')
    const gateway = new FakePaymentProvider()
    await withStore(app, storeId, (tx) =>
      refundPayment({ tx, storeId }, gateway, { paymentId, amountPaise: 90000 }),
    )
    await expect(
      withStore(app, storeId, (tx) =>
        refundPayment({ tx, storeId }, gateway, { paymentId, amountPaise: 20000 }),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    expect(gateway.calls).toHaveLength(1)
  })

  it('records COD refunds as manual without a gateway', async () => {
    const { storeId, paymentId } = await seed('cod')
    const row = await withStore(app, storeId, (tx) =>
      refundPayment({ tx, storeId }, null, { paymentId, amountPaise: 100000 }),
    )
    expect(row?.status).toBe('manual')
    expect(row?.providerRefundId).toBeNull()
    const [p] = await owner.select().from(payment).where(eq(payment.id, paymentId))
    expect(p?.status).toBe('refunded')
  })

  it('rejects pending payments and non-positive amounts', async () => {
    const { storeId, paymentId } = await seed('fake', 'pending')
    const gateway = new FakePaymentProvider()
    await expect(
      withStore(app, storeId, (tx) =>
        refundPayment({ tx, storeId }, gateway, { paymentId, amountPaise: 1000 }),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    await expect(
      withStore(app, storeId, (tx) =>
        refundPayment({ tx, storeId }, gateway, { paymentId, amountPaise: 0 }),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
  })
})

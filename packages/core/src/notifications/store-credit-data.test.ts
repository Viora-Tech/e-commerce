/** SOURCE OF TRUTH: store credit email data tests — WHAT: a draft invoice's applied credit and what is left to pay, the order confirmation's "used · balance" line, a refund's "added · balance" line, and nothing on other messages / WHY: the balance line goes only in the messages where the balance changed (owner, 12 Nov 2026) */
import { createDb, customer, order, payment, refund, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { changeStoreCredit, refundToStoreCredit } from '../customers/store-credit'
import { spendStoreCreditOnOrder } from '../customers/store-credit-checkout'
import { storeCreditTemplateData } from './store-credit-data'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

async function seed(status: 'open' | 'draft' = 'open') {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1001,
      status,
      subtotalPaise: 150_000,
      totalPaise: 150_000,
      email: 'asha@example.com',
      customerId: cu?.id ?? null,
    })
    .returning()
  if (!cu || !o) throw new Error('seed')
  await inStore(s.id, (tx) =>
    changeStoreCredit(
      { storeId: s.id, tx },
      { customerId: cu.id, amountPaise: 80_000, kind: 'adjustment', reason: 'Goodwill' },
    ),
  )
  return { storeId: s.id, customerId: cu.id, orderId: o.id }
}

describe('store credit in order emails', () => {
  it('draft invoice: the credit applied and what is left to pay', async () => {
    const { storeId, customerId, orderId } = await seed('draft')
    await owner.insert(payment).values({
      storeId,
      orderId,
      provider: 'store_credit',
      providerRef: `store_credit_draft_${orderId}`,
      providerPaymentId: customerId,
      status: 'created',
      amountPaise: 50_000,
    })
    const data = await inStore(storeId, (tx) =>
      storeCreditTemplateData({ storeId, tx }, { template: 'draft_invoice', orderId }),
    )
    expect(data).toEqual({ storeCredit: { appliedLabel: '−₹500.00', toPayLabel: '₹1,000.00' } })
  })

  it('order confirmation: used on the order, and the balance left', async () => {
    const { storeId, customerId, orderId } = await seed()
    await inStore(storeId, (tx) =>
      spendStoreCreditOnOrder({ storeId, tx }, { orderId, customerId, duePaise: 30_000 }),
    )
    const data = await inStore(storeId, (tx) =>
      storeCreditTemplateData({ storeId, tx }, { template: 'order_placed', orderId }),
    )
    expect(data).toEqual({
      storeCredit: { change: { kind: 'used', amountLabel: '₹300.00', balanceLabel: '₹500.00' } },
    })
    // Not in other messages, even for this order.
    for (const template of ['order_shipped', 'payment_received', 'delivered'] as const) {
      expect(
        await inStore(storeId, (tx) =>
          storeCreditTemplateData({ storeId, tx }, { template, orderId }),
        ),
      ).toBeNull()
    }
  })

  it('order confirmation without store credit: nothing', async () => {
    const { storeId, orderId } = await seed()
    expect(
      await inStore(storeId, (tx) =>
        storeCreditTemplateData({ storeId, tx }, { template: 'order_placed', orderId }),
      ),
    ).toBeNull()
  })

  it('refund to store credit: what was added and the balance', async () => {
    const { storeId, orderId } = await seed()
    await inStore(storeId, (tx) =>
      refundToStoreCredit({ storeId, tx }, { orderId, amountPaise: 20_000 }),
    )
    const [p] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId,
        provider: 'razorpay',
        providerRef: 'pay_1',
        status: 'captured',
        amountPaise: 150_000,
      })
      .returning()
    const [r] = await owner
      .insert(refund)
      .values({
        storeId,
        orderId,
        paymentId: p?.id as string,
        amountPaise: 20_000,
        method: 'store_credit',
        status: 'processed',
      })
      .returning()
    const data = await inStore(storeId, (tx) =>
      storeCreditTemplateData(
        { storeId, tx },
        { template: 'refund_issued', orderId, refundId: r?.id },
      ),
    )
    expect(data).toEqual({
      storeCredit: { change: { kind: 'added', amountLabel: '₹200.00', balanceLabel: '₹1,000.00' } },
    })
  })
})

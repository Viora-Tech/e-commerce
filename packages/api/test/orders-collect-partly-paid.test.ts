/** SOURCE OF TRUTH: tests for collecting the rest of a partly paid order — WHAT: an order with one capture already (imported, or part paid online) takes the rest recorded by hand as a second capture / WHY: the one-capture-per-order rule refused it with a 500 (#2398, 23 Nov 2026) */
import { createDb, order, payment, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { collectOrderPayment } from '../src/services/order-fulfil.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('collecting the rest of a partly paid order', () => {
  it('records the balance by hand beside the capture already on it', async () => {
    const [s] = await owner.insert(store).values({ slug: 'shop', name: 'Shop' }).returning()
    const storeId = s?.id as string
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1,
        email: 'shopper@example.com',
        status: 'open',
        paymentMethod: 'manual',
        subtotalPaise: 2699900,
        totalPaise: 2699900,
      })
      .returning()
    const orderId = o?.id as string
    // ₹25,000 paid already (an imported Shopify payment).
    await owner.insert(payment).values({
      storeId,
      orderId,
      provider: 'shopify',
      providerRef: 'shopify_import_1',
      status: 'captured',
      amountPaise: 2500000,
    })

    await withStore(app, storeId, (tx) =>
      collectOrderPayment(tx, storeId, {
        orderId,
        amountPaise: 199900,
        collected: {
          method: 'upi',
          receivedOn: '2026-11-23',
          recordedBy: 'owner@example.com',
          recordedAt: '2026-11-23T16:46:30.000Z',
        },
      }),
    )

    const rows = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.provider === 'manual')).toMatchObject({
      status: 'captured',
      amountPaise: 199900,
      multiCapture: true,
    })
    const [after] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(after?.paymentStatus).toBe('paid')
  })
})

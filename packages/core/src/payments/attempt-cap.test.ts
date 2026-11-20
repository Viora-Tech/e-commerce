import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  payment,
  product,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { FAILED_TRIES_PER_HOUR, FAILED_TRIES_WINDOW_MS } from './attempt-cap'
import { PaymentNotRetryable } from './attempts'
import { GatewayDouble } from './gateway-double.test-util'
import { retryAndStartPayment } from './qr-attempts'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** One order whose first gateway attempt failed. */
async function failedOrder(gw: GatewayDouble) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'w' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 10000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: s.id,
    cartId: c.id,
    variantId: v.id,
    quantity: 1,
    unitPricePaise: 10000,
  })
  gw.failNext = true
  const r = await placeOrderAndPay(app, s.id, { cartId: c.id, paymentProvider: gw })
  expect(r.paymentStatus).toBe('failed')
  return { storeId: s.id, orderId: r.orderId }
}

const failedRows = async (orderId: string) =>
  (await owner.select().from(payment).where(eq(payment.orderId, orderId))).filter(
    (p) => p.status === 'failed',
  )

describe('card testing guard: failed payment tries per order', () => {
  it('stops taking new gateway attempts after too many declines in an hour', async () => {
    const gw = new GatewayDouble()
    const { storeId, orderId } = await failedOrder(gw)
    // A real shopper's few retries all go through.
    for (let i = 1; i < FAILED_TRIES_PER_HOUR; i++) {
      gw.failNext = true
      const started = await retryAndStartPayment(app, storeId, orderId, gw)
      expect(started.status).toBe('failed')
    }
    expect(await failedRows(orderId)).toHaveLength(FAILED_TRIES_PER_HOUR)
    const asked = gw.created.length
    // The next one never reaches the gateway.
    await expect(retryAndStartPayment(app, storeId, orderId, gw)).rejects.toBeInstanceOf(
      PaymentNotRetryable,
    )
    expect(gw.created).toHaveLength(asked)
  })

  it('lets the order pay again once the declines are over an hour old', async () => {
    const gw = new GatewayDouble()
    const { storeId, orderId } = await failedOrder(gw)
    for (let i = 1; i < FAILED_TRIES_PER_HOUR; i++) {
      gw.failNext = true
      await retryAndStartPayment(app, storeId, orderId, gw)
    }
    await owner
      .update(payment)
      .set({ createdAt: new Date(Date.now() - FAILED_TRIES_WINDOW_MS - 60_000) })
      .where(eq(payment.orderId, orderId))
    const started = await retryAndStartPayment(app, storeId, orderId, gw)
    expect(started.status).toBe('pending')
  })
})

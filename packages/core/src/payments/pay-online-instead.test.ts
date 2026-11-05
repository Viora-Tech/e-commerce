/** SOURCE OF TRUTH: pay online instead of a transfer — WHAT: the transfer's discount goes, the fee stays; HOW: real orders against the test database. */
import {
  cart,
  cartLine,
  createDb,
  fulfillmentOrder,
  inventoryLevel,
  order,
  orderNote,
  payment,
  product,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { GatewayDouble } from './gateway-double.test-util'
import { payOnlineInstead } from './pay-online-instead'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A placed order for ₹100 turned into a waiting transfer, with `adjustmentPaise` inside it. */
async function transferOrder(adjustmentPaise: number) {
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
  const placed = await placeOrderAndPay(app, s.id, {
    cartId: c.id,
    paymentProvider: new GatewayDouble(),
  })
  const totalPaise = 10000 + adjustmentPaise
  await owner
    .update(order)
    .set({
      paymentMethod: 'manual',
      paymentAdjustmentPaise: adjustmentPaise,
      paymentAdjustmentLabel: 'UPI discount',
      totalPaise,
    })
    .where(eq(order.id, placed.orderId))
  await owner
    .update(payment)
    .set({ provider: 'manual', status: 'pending', amountPaise: totalPaise })
    .where(eq(payment.orderId, placed.orderId))
  return { storeId: s.id, orderId: placed.orderId }
}

describe('payOnlineInstead', () => {
  it('takes the transfer discount off the order and asks the gateway for the full amount', async () => {
    const { storeId, orderId } = await transferOrder(-200)
    const gateway = new GatewayDouble()
    await payOnlineInstead(app, storeId, orderId, gateway)

    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.totalPaise).toBe(10000)
    expect(o?.paymentAdjustmentPaise).toBe(0)
    expect(o?.paymentAdjustmentLabel).toBeNull()

    const pays = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(pays.find((p) => p.provider === 'manual')?.status).toBe('cancelled')
    expect(pays.find((p) => p.provider === gateway.id)?.amountPaise).toBe(10000)

    const [parcel] = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, orderId))
    expect(parcel?.adjustmentPaise).toBe(0)
    expect(parcel?.totalPaise).toBe(10000)

    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.at(-1)?.body).toContain('transfer discount')
  })

  it('charges once when the shopper taps twice', async () => {
    const { storeId, orderId } = await transferOrder(-200)
    const gateway = new GatewayDouble()
    await payOnlineInstead(app, storeId, orderId, gateway)
    await payOnlineInstead(app, storeId, orderId, gateway)

    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.totalPaise).toBe(10000)
    const pays = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(pays.filter((p) => p.provider === gateway.id)).toHaveLength(1)
  })

  it('keeps a fee on the way to pay', async () => {
    const { storeId, orderId } = await transferOrder(500)
    const gateway = new GatewayDouble()
    await payOnlineInstead(app, storeId, orderId, gateway)

    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.totalPaise).toBe(10500)
    expect(o?.paymentAdjustmentPaise).toBe(500)
    const pays = await owner.select().from(payment).where(eq(payment.orderId, orderId))
    expect(pays.find((p) => p.provider === gateway.id)?.amountPaise).toBe(10500)
  })
})

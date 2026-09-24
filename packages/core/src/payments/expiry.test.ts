import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderNote,
  payment,
  product,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { PaymentProvider } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { CodPaymentProvider } from '../providers/cod'
import { expireUnpaidOrders } from './expiry'
import { GatewayDouble } from './gateway-double.test-util'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const NOW = new Date('2026-09-24T12:00:00Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000)

async function seedStore(slug: string, expireUnpaidAfterMinutes = 30) {
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      payments: {
        enabled: ['gw', 'cod'],
        providers: {},
        adjustments: {},
        expireUnpaidAfterMinutes,
      },
    })
    .returning()
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
  return { storeId: s.id, variantId: v.id }
}

/** Place a one-unit order and backdate it. */
async function order1(
  shop: { storeId: string; variantId: string },
  provider: PaymentProvider,
  ageMinutes: number,
) {
  const [c] = await owner.insert(cart).values({ storeId: shop.storeId }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: shop.storeId,
    cartId: c.id,
    variantId: shop.variantId,
    quantity: 1,
    unitPricePaise: 10000,
  })
  const r = await placeOrderAndPay(app, shop.storeId, { cartId: c.id, paymentProvider: provider })
  await owner
    .update(order)
    .set({ placedAt: minutesAgo(ageMinutes) })
    .where(eq(order.id, r.orderId))
  return r
}

const reserved = async (variantId: string) =>
  (await owner.select().from(inventoryLevel).where(eq(inventoryLevel.variantId, variantId)))[0]
    ?.reserved

const statusOf = async (orderId: string) =>
  (await owner.select().from(order).where(eq(order.id, orderId)))[0]?.status

describe('unpaid order expiry', () => {
  it('cancels an online order past the window, releases its stock and records why', async () => {
    const shop = await seedStore('w')
    const gw = new GatewayDouble()
    const old = await order1(shop, gw, 45)
    const fresh = await order1(shop, gw, 10)
    expect(await reserved(shop.variantId)).toBe(2)

    const out = await expireUnpaidOrders(app, shop.storeId, [gw], NOW)

    expect(out).toEqual([{ orderId: old.orderId, result: 'cancelled' }])
    expect(await statusOf(old.orderId)).toBe('cancelled')
    expect(await statusOf(fresh.orderId)).toBe('placed')
    expect(await reserved(shop.variantId)).toBe(1)
    const [a] = await owner.select().from(payment).where(eq(payment.orderId, old.orderId))
    expect(a?.status).toBe('cancelled')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, old.orderId))
    expect(notes[0]?.body).toContain('30 minutes')
  })

  it('asks the gateway first: a captured payment marks the order paid instead', async () => {
    const shop = await seedStore('w')
    const gw = new GatewayDouble()
    const r = await order1(shop, gw, 45)
    gw.status.set('order_1', 'captured')

    const out = await expireUnpaidOrders(app, shop.storeId, [gw], NOW)

    expect(out).toEqual([{ orderId: r.orderId, result: 'paid' }])
    expect(await statusOf(r.orderId)).toBe('paid')
    expect(await reserved(shop.variantId)).toBe(1)
  })

  it('leaves the order alone when the gateway cannot be asked', async () => {
    const shop = await seedStore('w')
    const gw = new GatewayDouble()
    const r = await order1(shop, gw, 45)
    gw.fetchFails = true

    const [out] = await expireUnpaidOrders(app, shop.storeId, [gw], NOW)

    expect(out).toMatchObject({ orderId: r.orderId, result: 'skipped' })
    expect(await statusOf(r.orderId)).toBe('placed')
    expect(await reserved(shop.variantId)).toBe(1)
  })

  it('never expires cash on delivery', async () => {
    const shop = await seedStore('w')
    const r = await order1(shop, new CodPaymentProvider(), 600)

    expect(await expireUnpaidOrders(app, shop.storeId, [], NOW)).toEqual([])
    expect(await statusOf(r.orderId)).toBe('placed')
  })

  it('expires an order once, however many runs overlap', async () => {
    const shop = await seedStore('w')
    const gw = new GatewayDouble()
    const keep = await order1(shop, gw, 5)
    const r = await order1(shop, gw, 45)

    const runs = await Promise.all([
      expireUnpaidOrders(app, shop.storeId, [gw], NOW),
      expireUnpaidOrders(app, shop.storeId, [gw], NOW),
      expireUnpaidOrders(app, shop.storeId, [gw], NOW),
    ])
    await expireUnpaidOrders(app, shop.storeId, [gw], NOW)

    const cancelled = runs.flat().filter((o) => o.result === 'cancelled')
    expect(cancelled).toEqual([{ orderId: r.orderId, result: 'cancelled' }])
    // One unit released: the other order still holds its unit.
    expect(await reserved(shop.variantId)).toBe(1)
    expect(await statusOf(keep.orderId)).toBe('placed')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, r.orderId))
    expect(notes).toHaveLength(1)
  })

  it("keeps to one store's orders and honours each store's window", async () => {
    const a = await seedStore('a')
    const b = await seedStore('b', 0)
    const gw = new GatewayDouble()
    const ra = await order1(a, gw, 45)
    const rb = await order1(b, gw, 600)

    const outB = await expireUnpaidOrders(app, b.storeId, [gw], NOW)
    expect(outB).toEqual([])
    const outA = await expireUnpaidOrders(app, a.storeId, [gw], NOW)
    expect(outA).toEqual([{ orderId: ra.orderId, result: 'cancelled' }])
    expect(await statusOf(rb.orderId)).toBe('placed')
    expect(await reserved(b.variantId)).toBe(1)
  })
})

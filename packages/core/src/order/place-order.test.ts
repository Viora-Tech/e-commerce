import {
  cart,
  cartLine,
  createDb,
  inventoryLevel,
  order,
  orderLine,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { CartNotOpen, OutOfStock, PaymentFailed } from '../errors'
import { FakePaymentProvider } from '../providers/payment'
import { placeOrder } from './place-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type Seed = { storeId: string; cartId: string; variantId: string }

async function seed(opts: { onHand: number; quantity: number }): Promise<Seed> {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 499900 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: opts.onHand })
  const [c] = await owner.insert(cart).values({ storeId: s.id }).returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: s.id,
    cartId: c.id,
    variantId: v.id,
    quantity: opts.quantity,
    unitPricePaise: v.pricePaise,
  })
  return { storeId: s.id, cartId: c.id, variantId: v.id }
}

beforeEach(async () => {
  await resetDb(owner)
})

describe('placeOrder', () => {
  it('reserves stock, creates the order and payment, converts the cart', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'capture' })

    const result = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: provider }),
    )

    expect(result.orderNumber).toBe(1)
    expect(result.paymentStatus).toBe('captured')

    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.totalPaise).toBe(999800)
    expect(o?.status).toBe('paid')
    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, result.orderId))
    expect(lines).toHaveLength(1)
    const [pay] = await owner.select().from(payment).where(eq(payment.orderId, result.orderId))
    expect(pay?.status).toBe('captured')
    expect(pay?.amountPaise).toBe(999800)
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(2)
    const [c] = await owner.select().from(cart).where(eq(cart.id, cartId))
    expect(c?.status).toBe('converted')
    const [s] = await owner.select().from(store).where(eq(store.id, storeId))
    expect(s?.nextOrderNumber).toBe(2)
    expect(provider.calls).toEqual([`createPayment:${result.orderId}:999800`])
  })

  it('throws OutOfStock and leaves nothing behind when stock is short', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 1, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'capture' })

    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: provider }),
      ),
    ).rejects.toBeInstanceOf(OutOfStock)

    expect(await owner.select().from(order)).toEqual([])
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(0)
    expect(provider.calls).toEqual([])
  })

  it('throws PaymentFailed, releases stock and keeps the cart open when the gateway declines', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'fail' })

    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: provider }),
      ),
    ).rejects.toBeInstanceOf(PaymentFailed)

    expect(await owner.select().from(order)).toEqual([])
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(0)
    const [c] = await owner.select().from(cart).where(eq(cart.id, cartId))
    expect(c?.status).toBe('open')
  })

  it('rejects a cart that is not open', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await owner.update(cart).set({ status: 'converted' }).where(eq(cart.id, cartId))
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
      ),
    ).rejects.toBeInstanceOf(CartNotOpen)
  })

  it('order numbers increase per store', async () => {
    const first = await seed({ onHand: 10, quantity: 1 })
    const [c2] = await owner.insert(cart).values({ storeId: first.storeId }).returning()
    if (!c2) throw new Error('seed')
    await owner.insert(cartLine).values({
      storeId: first.storeId,
      cartId: c2.id,
      variantId: first.variantId,
      quantity: 1,
      unitPricePaise: 499900,
    })
    const provider = new FakePaymentProvider()
    const r1 = await withStore(app, first.storeId, (tx) =>
      placeOrder(
        { storeId: first.storeId, tx },
        { cartId: first.cartId, paymentProvider: provider },
      ),
    )
    const r2 = await withStore(app, first.storeId, (tx) =>
      placeOrder({ storeId: first.storeId, tx }, { cartId: c2.id, paymentProvider: provider }),
    )
    expect([r1.orderNumber, r2.orderNumber]).toEqual([1, 2])
  })
})

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
import { CartEmpty, CartNotOpen, OutOfStock, PaymentFailed } from '../errors'
import { FakePaymentProvider, type PaymentProvider } from '../providers/payment'
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

  it('applies the payment-method fee or discount from store settings', async () => {
    const codFee = { type: 'fixed', value: 4900, label: 'COD handling' }
    const upiOff = { type: 'percent', value: -200, label: 'UPI discount' }
    const first = await seed({ onHand: 10, quantity: 1 })
    await owner
      .update(store)
      .set({ payments: { enabled: ['cod', 'upi'], adjustments: { cod: codFee, upi: upiOff } } })
      .where(eq(store.id, first.storeId))
    const [c2] = await owner.insert(cart).values({ storeId: first.storeId }).returning()
    if (!c2) throw new Error('seed')
    await owner.insert(cartLine).values({
      storeId: first.storeId,
      cartId: c2.id,
      variantId: first.variantId,
      quantity: 1,
      unitPricePaise: 499900,
    })
    const cod = new FakePaymentProvider({ mode: 'capture', id: 'cod' })
    const upi = new FakePaymentProvider({ mode: 'capture', id: 'upi' })

    const r1 = await withStore(app, first.storeId, (tx) =>
      placeOrder({ storeId: first.storeId, tx }, { cartId: first.cartId, paymentProvider: cod }),
    )
    const r2 = await withStore(app, first.storeId, (tx) =>
      placeOrder({ storeId: first.storeId, tx }, { cartId: c2.id, paymentProvider: upi }),
    )

    const [o1] = await owner.select().from(order).where(eq(order.id, r1.orderId))
    expect(o1).toMatchObject({
      subtotalPaise: 499900,
      paymentAdjustmentPaise: 4900,
      paymentAdjustmentLabel: 'COD handling',
      totalPaise: 504800,
    })
    const [o2] = await owner.select().from(order).where(eq(order.id, r2.orderId))
    expect(o2).toMatchObject({
      subtotalPaise: 499900,
      paymentAdjustmentPaise: -9998,
      paymentAdjustmentLabel: 'UPI discount',
      totalPaise: 489902,
    })
    const [p2] = await owner.select().from(payment).where(eq(payment.orderId, r2.orderId))
    expect(p2?.amountPaise).toBe(489902)
    expect(upi.calls).toEqual([`createPayment:${r2.orderId}:489902`])
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

  it('rejects an open cart with no lines', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await owner.delete(cartLine).where(eq(cartLine.cartId, cartId))
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
      ),
    ).rejects.toBeInstanceOf(CartEmpty)
  })

  it('refunds a captured payment when the database fails afterwards', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const refunds: string[] = []
    // Captures money, then reports a status the payment table's check constraint rejects.
    const brokenRef: PaymentProvider = {
      id: 'broken',
      label: 'Broken',
      async createPayment() {
        return {
          providerRef: 'pay_broken',
          status: 'captured-but-weird' as unknown as 'captured',
          session: { kind: 'none', provider: 'broken', providerRef: 'pay_broken' },
        }
      },
      async confirm() {
        return { status: 'captured', providerPaymentId: 'x' }
      },
      async fetchStatus() {
        return { status: 'captured', providerPaymentId: 'x', amountPaise: 0 }
      },
      async refund(ref, amountPaise) {
        refunds.push(`${ref}:${amountPaise}`)
        return { providerRefundId: 'rf', status: 'processed' }
      },
      parseWebhook() {
        return { ok: false, reason: 'none' }
      },
    }
    const silent = { error: () => {} }
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: brokenRef }, silent),
      ),
    ).rejects.toThrow()
    expect(refunds).toEqual(['pay_broken:499900'])
    expect(await owner.select().from(order)).toEqual([])
  })
})

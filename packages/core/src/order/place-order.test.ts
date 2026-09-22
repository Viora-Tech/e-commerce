import {
  cart,
  cartLine,
  createDb,
  customer,
  discount,
  discountUsage,
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

  it('applies a discount code from the cart, records usage and drops a used-up code', async () => {
    const first = await seed({ onHand: 10, quantity: 1 })
    const [d] = await owner
      .insert(discount)
      .values({
        storeId: first.storeId,
        title: 'Launch 10% off',
        kind: 'code',
        code: 'LAUNCH10',
        method: 'percent',
        value: 1000,
        usageLimit: 1,
      })
      .returning()
    if (!d) throw new Error('seed')
    await owner.update(cart).set({ discountCode: 'launch10' }).where(eq(cart.id, first.cartId))
    const provider = new FakePaymentProvider({ mode: 'capture' })

    const r1 = await withStore(app, first.storeId, (tx) =>
      placeOrder(
        { storeId: first.storeId, tx },
        { cartId: first.cartId, paymentProvider: provider },
      ),
    )
    const [o1] = await owner.select().from(order).where(eq(order.id, r1.orderId))
    expect(o1).toMatchObject({
      subtotalPaise: 499900,
      discountCode: 'LAUNCH10',
      discountLabel: 'Launch 10% off',
      discountPaise: 49990,
      totalPaise: 449910,
    })
    expect(provider.calls).toEqual([`createPayment:${r1.orderId}:449910`])
    const [used] = await owner.select().from(discount).where(eq(discount.id, d.id))
    expect(used?.usedCount).toBe(1)
    const usage = await owner
      .select()
      .from(discountUsage)
      .where(eq(discountUsage.orderId, r1.orderId))
    expect(usage).toHaveLength(1)

    // Limit reached: the next cart with the same code is charged full price, not blocked.
    const [c2] = await owner
      .insert(cart)
      .values({ storeId: first.storeId, discountCode: 'LAUNCH10' })
      .returning()
    if (!c2) throw new Error('seed')
    await owner.insert(cartLine).values({
      storeId: first.storeId,
      cartId: c2.id,
      variantId: first.variantId,
      quantity: 1,
      unitPricePaise: 499900,
    })
    const r2 = await withStore(app, first.storeId, (tx) =>
      placeOrder({ storeId: first.storeId, tx }, { cartId: c2.id, paymentProvider: provider }),
    )
    const [o2] = await owner.select().from(order).where(eq(order.id, r2.orderId))
    expect(o2).toMatchObject({ discountCode: null, discountPaise: 0, totalPaise: 499900 })
  })

  it('applies the best automatic discount without a code and undoes usage on failure', async () => {
    const first = await seed({ onHand: 10, quantity: 2 })
    await owner.insert(discount).values([
      {
        storeId: first.storeId,
        title: 'Festive 5%',
        kind: 'automatic',
        method: 'percent',
        value: 500,
      },
      {
        storeId: first.storeId,
        title: 'Flat 200',
        kind: 'automatic',
        method: 'fixed',
        value: 20000,
        minSubtotalPaise: 900000,
      },
    ])

    const declined = new FakePaymentProvider({ mode: 'fail' })
    await expect(
      withStore(app, first.storeId, (tx) =>
        placeOrder(
          { storeId: first.storeId, tx },
          { cartId: first.cartId, paymentProvider: declined },
        ),
      ),
    ).rejects.toBeInstanceOf(PaymentFailed)
    const rows = await owner.select().from(discount)
    expect(rows.every((r) => r.usedCount === 0)).toBe(true)

    const ok = new FakePaymentProvider({ mode: 'capture' })
    const r = await withStore(app, first.storeId, (tx) =>
      placeOrder({ storeId: first.storeId, tx }, { cartId: first.cartId, paymentProvider: ok }),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    // 5% of 999800 = 49990 beats the flat 200.
    expect(o).toMatchObject({
      discountLabel: 'Festive 5%',
      discountPaise: 49990,
      totalPaise: 949810,
    })
  })

  it('keeps one customer per email per store and refreshes their details on a repeat order', async () => {
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
    const checkout = (name: string, email: string, city: string) => ({
      name,
      email,
      phone: '9999999999',
      address: { line1: '12 MG Road', city, stateCode: 'KA', pincode: '560001' },
    })
    const provider = new FakePaymentProvider({ mode: 'capture' })

    const r1 = await withStore(app, first.storeId, (tx) =>
      placeOrder(
        { storeId: first.storeId, tx },
        {
          cartId: first.cartId,
          paymentProvider: provider,
          checkout: checkout('Asha Menon', 'Asha@Example.com', 'Bengaluru'),
        },
      ),
    )
    const r2 = await withStore(app, first.storeId, (tx) =>
      placeOrder(
        { storeId: first.storeId, tx },
        {
          cartId: c2.id,
          paymentProvider: provider,
          checkout: checkout('Asha M.', 'asha@example.com ', 'Mysuru'),
        },
      ),
    )

    const rows = await owner.select().from(customer).where(eq(customer.storeId, first.storeId))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email: 'asha@example.com', name: 'Asha M.' })
    expect(rows[0]?.defaultAddress?.city).toBe('Mysuru')
    const [o1] = await owner.select().from(order).where(eq(order.id, r1.orderId))
    const [o2] = await owner.select().from(order).where(eq(order.id, r2.orderId))
    expect(o1?.customerId).toBe(rows[0]?.id)
    expect(o2?.customerId).toBe(rows[0]?.id)
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

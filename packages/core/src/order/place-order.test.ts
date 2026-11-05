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
  outboxEvent,
  payment,
  product,
  store,
  storeCounter,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { CheckoutSession } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  CartEmpty,
  CartNotOpen,
  CheckoutRuleViolation,
  DiscountCodeRefused,
  DiscountUnavailable,
  OutOfStock,
  PriceNotSet,
  VariantHidden,
} from '../errors'
import { setCartAttribution } from '../marketing/sessions'
import { FakePaymentProvider, type PaymentProvider } from '../providers/payment'
import { placeOrder, placeOrderAndPay } from './place-order'

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
    unitPricePaise: 499900,
  })
  return { storeId: s.id, cartId: c.id, variantId: v.id }
}

beforeEach(async () => {
  await resetDb(owner)
})

describe('placeOrder attribution', () => {
  it('copies the cart marketing touch onto the order', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const touch = {
      channel: 'email' as const,
      source: 'newsletter',
      campaignId: '0199a000-0000-7000-8000-000000000001',
      at: new Date().toISOString(),
    }
    const result = await withStore(app, storeId, async (tx) => {
      await setCartAttribution(tx, cartId, touch)
      return placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() })
    })
    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.attribution).toEqual(touch)
  })

  it('copies the cart pixel tracking onto the order', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const tracking = {
      fbp: 'fb.1.1792800000000.1234567890',
      ip: '203.0.113.7',
      ua: 'Mozilla/5.0',
      consent: { marketing: true, analytics: true, version: 3, at: new Date().toISOString() },
    }
    await owner.update(cart).set({ tracking }).where(eq(cart.id, cartId))
    const result = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.tracking).toEqual(tracking)
  })
})

describe('placeOrder', () => {
  it('reserves stock, creates the order and payment, converts the cart', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'capture' })

    const result = await placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider })

    expect(result.orderNumber).toBe(1)
    expect(result.paymentStatus).toBe('captured')

    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.totalPaise).toBe(999800)
    expect(o?.paymentStatus).toBe('paid')
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
    // Numbers come from `store_counter` (0177), not the store row.
    const [n] = await owner.select().from(storeCounter).where(eq(storeCounter.storeId, storeId))
    expect(n?.value).toBe(2)
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

    const r1 = await placeOrderAndPay(app, first.storeId, {
      cartId: first.cartId,
      paymentProvider: cod,
    })
    const r2 = await placeOrderAndPay(app, first.storeId, { cartId: c2.id, paymentProvider: upi })

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
      // −2% of ₹4,999 is −₹99.98: a whole −₹100, so a round ₹4,899 (#1049).
      paymentAdjustmentPaise: -10000,
      paymentAdjustmentLabel: 'UPI discount',
      totalPaise: 489900,
    })
    const [p2] = await owner.select().from(payment).where(eq(payment.orderId, r2.orderId))
    expect(p2?.amountPaise).toBe(489900)
    expect(upi.calls).toEqual([`createPayment:${r2.orderId}:489900`])
  })

  it('applies a discount code from the cart, records usage and refuses a used-up code', async () => {
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

    const r1 = await placeOrderAndPay(app, first.storeId, {
      cartId: first.cartId,
      paymentProvider: provider,
    })
    const [o1] = await owner.select().from(order).where(eq(order.id, r1.orderId))
    expect(o1).toMatchObject({
      subtotalPaise: 499900,
      discountCode: 'LAUNCH10',
      discountLabel: 'Launch 10% off',
      // 10% of ₹4,999 is ₹499.90, rounded to ₹500 (#141).
      discountPaise: 50000,
      totalPaise: 449900,
    })
    expect(provider.calls).toEqual([`createPayment:${r1.orderId}:449900`])
    const [used] = await owner.select().from(discount).where(eq(discount.id, d.id))
    expect(used?.usedCount).toBe(1)
    const usage = await owner
      .select()
      .from(discountUsage)
      .where(eq(discountUsage.orderId, r1.orderId))
    expect(usage).toHaveLength(1)

    // Limit reached: the next cart with the same code is refused, never charged the full price
    // behind the shopper's back (the summary showed the discount).
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
    await expect(
      placeOrderAndPay(app, first.storeId, { cartId: c2.id, paymentProvider: provider }),
    ).rejects.toBeInstanceOf(DiscountCodeRefused)
    expect(await owner.select().from(order).where(eq(order.cartId, c2.id))).toHaveLength(0)
  })

  it('applies the best automatic discount without a code', async () => {
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

    const ok = new FakePaymentProvider({ mode: 'capture' })
    const r = await placeOrderAndPay(app, first.storeId, {
      cartId: first.cartId,
      paymentProvider: ok,
    })
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    // 5% of 999800 = 49990, rounded to ₹500, beats the flat 200.
    expect(o).toMatchObject({
      discountLabel: 'Festive 5%',
      discountPaise: 50000,
      totalPaise: 949800,
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

    const r1 = await placeOrderAndPay(app, first.storeId, {
      cartId: first.cartId,
      paymentProvider: provider,
      checkout: checkout('Asha Menon', 'Asha@Example.com', 'Bengaluru'),
    })
    const r2 = await placeOrderAndPay(app, first.storeId, {
      cartId: c2.id,
      paymentProvider: provider,
      checkout: checkout('Asha M.', 'asha@example.com ', 'Mysuru'),
    })

    const rows = await owner.select().from(customer).where(eq(customer.storeId, first.storeId))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ email: 'asha@example.com', name: 'Asha M.' })
    expect(rows[0]?.defaultAddress?.city).toBe('Mysuru')
    const [o1] = await owner.select().from(order).where(eq(order.id, r1.orderId))
    const [o2] = await owner.select().from(order).where(eq(order.id, r2.orderId))
    expect(o1?.customerId).toBe(rows[0]?.id)
    expect(o2?.customerId).toBe(rows[0]?.id)
  })

  it('saves a checkout GSTIN on the customer and keeps it when a later checkout has none', async () => {
    const first = await seed({ onHand: 10, quantity: 1 })
    await owner
      .update(store)
      .set({ preferences: { checkout: { gstin: true } } })
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
    const checkout = (gstin: string | null, businessName: string | null) => ({
      name: 'Asha Menon',
      email: 'asha@example.com',
      phone: '9999999999',
      address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
      gstin,
      businessName,
    })
    const provider = new FakePaymentProvider({ mode: 'capture' })
    await placeOrderAndPay(app, first.storeId, {
      cartId: first.cartId,
      paymentProvider: provider,
      checkout: checkout('29aabct3518q1zs', 'Asha Traders'),
    })
    await placeOrderAndPay(app, first.storeId, {
      cartId: c2.id,
      paymentProvider: provider,
      checkout: checkout(null, null),
    })
    const [row] = await owner.select().from(customer).where(eq(customer.storeId, first.storeId))
    expect(row).toMatchObject({ gstin: '29AABCT3518Q1ZS', businessName: 'Asha Traders' })
  })

  it('throws OutOfStock and leaves nothing behind when stock is short', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 1, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'capture' })

    await expect(
      placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider }),
    ).rejects.toBeInstanceOf(OutOfStock)

    expect(await owner.select().from(order)).toEqual([])
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(0)
    expect(provider.calls).toEqual([])
  })

  it('keeps the order and its stock, and fails only the attempt, when the gateway errors after commit', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'fail' })

    const r = await placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider })

    expect(r).toMatchObject({ paymentStatus: 'failed', session: null, becameCaptured: false })
    expect(r.paymentError).toContain('declined')
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.status).toBe('open')
    const [pay] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(pay).toMatchObject({ status: 'failed', attempt: 1, idempotencyKey: `${r.orderId}:1` })
    expect(pay?.error).toContain('declined')
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(2)
    const [c] = await owner.select().from(cart).where(eq(cart.id, cartId))
    expect(c?.status).toBe('converted')
  })

  it('never calls the gateway inside the stock transaction', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const provider = new FakePaymentProvider({ mode: 'capture' })
    const r = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: provider }),
    )
    expect(provider.calls).toEqual([])
    expect(r).toMatchObject({ paymentStatus: 'created', session: null })
    const [pay] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(pay).toMatchObject({ status: 'created', gatewayRequestedAt: null })
  })

  it('refuses a state that does not match the PIN code, before anything is reserved (D-06)', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 1 })
    const provider = new FakePaymentProvider({ mode: 'capture' })
    const run = placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: provider,
      checkout: {
        name: 'Asha',
        email: 'asha@example.com',
        phone: '9999999999',
        // A Bengaluru PIN with Delhi's state would take Delhi's zone and the wrong GST split.
        address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'DL', pincode: '560001' },
      },
    })
    await expect(run).rejects.toBeInstanceOf(CheckoutRuleViolation)
    await expect(run).rejects.toMatchObject({ rule: 'state_mismatch' })
    expect(await owner.select().from(order)).toEqual([])
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(0)
    expect(provider.calls).toEqual([])
  })

  it('refuses a cart whose item lost its price after it was added (#913)', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 1 })
    await owner.update(variant).set({ pricePaise: null }).where(eq(variant.id, variantId))
    const provider = new FakePaymentProvider({ mode: 'capture' })
    await expect(
      placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider }),
    ).rejects.toBeInstanceOf(PriceNotSet)
    expect(await owner.select().from(order)).toEqual([])
    expect(provider.calls).toEqual([])
  })

  it('refuses a cart whose item was hidden on the storefront after it was added (#934)', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 1 })
    await owner.update(variant).set({ hiddenOnStore: true }).where(eq(variant.id, variantId))
    const provider = new FakePaymentProvider({ mode: 'capture' })
    await expect(
      placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider }),
    ).rejects.toBeInstanceOf(VariantHidden)
    expect(await owner.select().from(order)).toEqual([])
    expect(provider.calls).toEqual([])
  })

  it('rejects a cart that is not open', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await owner.update(cart).set({ status: 'converted' }).where(eq(cart.id, cartId))
    await expect(
      placeOrderAndPay(app, storeId, { cartId, paymentProvider: new FakePaymentProvider() }),
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
    const r1 = await placeOrderAndPay(app, first.storeId, {
      cartId: first.cartId,
      paymentProvider: provider,
    })
    const r2 = await placeOrderAndPay(app, first.storeId, {
      cartId: c2.id,
      paymentProvider: provider,
    })
    expect([r1.orderNumber, r2.orderNumber]).toEqual([1, 2])
  })

  it('rejects an open cart with no lines', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await owner.delete(cartLine).where(eq(cartLine.cartId, cartId))
    await expect(
      placeOrderAndPay(app, storeId, { cartId, paymentProvider: new FakePaymentProvider() }),
    ).rejects.toBeInstanceOf(CartEmpty)
  })

  it('refunds a captured payment when the database fails afterwards', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const refunds: string[] = []
    // Captures money at creation, then hands back a session the database cannot store.
    const brokenRef: PaymentProvider = {
      id: 'broken',
      label: 'Broken',
      async createPayment() {
        return {
          providerRef: 'pay_broken',
          status: 'captured',
          // A BigInt cannot be serialised into jsonb, so recording the answer fails.
          session: {
            kind: 'none',
            provider: 'broken',
            providerRef: 'pay_broken',
            extra: BigInt(1),
          } as unknown as CheckoutSession,
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
    const r = await placeOrderAndPay(app, storeId, { cartId, paymentProvider: brokenRef })
    expect(refunds).toEqual(['pay_broken:499900'])
    expect(r.paymentStatus).toBe('failed')
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.status).toBe('open')
    const [pay] = await owner.select().from(payment).where(eq(payment.orderId, r.orderId))
    expect(pay?.status).toBe('failed')
  })
})

describe('placeOrder discount limits under concurrency', () => {
  const checkout = {
    email: 'Shopper@Example.com',
    phone: '9876543210',
    name: 'Shopper',
    address: { line1: '1 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
  }

  async function cartsWithCode(first: Seed, code: string, n: number): Promise<string[]> {
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      const [c] = await owner
        .insert(cart)
        .values({ storeId: first.storeId, discountCode: code })
        .returning()
      if (!c) throw new Error('seed')
      await owner.insert(cartLine).values({
        storeId: first.storeId,
        cartId: c.id,
        variantId: first.variantId,
        quantity: 1,
        unitPricePaise: 499900,
      })
      ids.push(c.id)
    }
    return ids
  }

  async function checkoutAll(first: Seed, cartIds: string[], withDetails: boolean) {
    return Promise.allSettled(
      cartIds.map((cartId) =>
        placeOrderAndPay(app, first.storeId, {
          cartId,
          paymentProvider: new FakePaymentProvider({ mode: 'capture' }),
          ...(withDetails ? { checkout } : {}),
        }),
      ),
    )
  }

  it('8 parallel checkouts on a code with limit 5 redeem it exactly 5 times', async () => {
    const first = await seed({ onHand: 100, quantity: 1 })
    const [d] = await owner
      .insert(discount)
      .values({
        storeId: first.storeId,
        title: 'Drop 10%',
        kind: 'code',
        code: 'DROP10',
        method: 'percent',
        value: 1000,
        usageLimit: 5,
      })
      .returning()
    if (!d) throw new Error('seed')
    await owner.update(cart).set({ discountCode: 'DROP10' }).where(eq(cart.id, first.cartId))
    const cartIds = await cartsWithCode(first, 'DROP10', 7)

    const results = await checkoutAll(first, [first.cartId, ...cartIds], false)

    const [row] = await owner.select().from(discount).where(eq(discount.id, d.id))
    expect(row?.usedCount).toBe(5)
    expect(await owner.select().from(discountUsage)).toHaveLength(5)
    const orders = await owner.select().from(order)
    expect(orders.filter((o) => o.discountCode === 'DROP10')).toHaveLength(5)
    // Every other checkout either failed cleanly or (if it priced after the limit was hit) paid full price.
    for (const r of results) {
      // Lost the race for the last use, or found the use already taken: never placed at full price.
      if (r.status === 'rejected')
        expect(
          r.reason instanceof DiscountUnavailable || r.reason instanceof DiscountCodeRefused,
        ).toBe(true)
    }
    expect(orders.filter((o) => o.discountCode === null).every((o) => o.discountPaise === 0)).toBe(
      true,
    )
    expect(orders.length + results.filter((r) => r.status === 'rejected').length).toBe(8)
  })

  it('a per-customer cap of 1 holds across parallel checkouts by the same shopper', async () => {
    const first = await seed({ onHand: 100, quantity: 1 })
    await owner.insert(discount).values({
      storeId: first.storeId,
      title: 'First order',
      kind: 'code',
      code: 'FIRST',
      method: 'fixed',
      value: 10000,
      usagePerCustomer: 1,
    })
    const cartIds = await cartsWithCode(first, 'FIRST', 3)

    const results = await checkoutAll(first, cartIds, true)

    const usage = await owner.select().from(discountUsage)
    expect(usage).toHaveLength(1)
    expect(usage[0]?.email).toBe('shopper@example.com')
    for (const r of results) {
      // Lost the race for the last use, or found the use already taken: never placed at full price.
      if (r.status === 'rejected')
        expect(
          r.reason instanceof DiscountUnavailable || r.reason instanceof DiscountCodeRefused,
        ).toBe(true)
    }
  })
})

describe('placeOrder lock and replay', () => {
  it('two concurrent submits of one cart create exactly one order', async () => {
    const { storeId, cartId, variantId } = await seed({ onHand: 5, quantity: 2 })
    const provider = new FakePaymentProvider({ mode: 'capture' })
    const submit = () => placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider })

    const [a, b] = await Promise.all([submit(), submit()])

    expect(a.orderId).toBe(b.orderId)
    expect(a.orderNumber).toBe(b.orderNumber)
    expect([a.replayed, b.replayed].sort()).toEqual([false, true])
    expect(await owner.select().from(order)).toHaveLength(1)
    expect(provider.calls).toHaveLength(1)
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(2)
  })

  it('a retry after the order is placed returns the same order and session', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const provider = new FakePaymentProvider()
    const submit = () => placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider })

    const first = await submit()
    const retry = await submit()

    expect(retry).toEqual({ ...first, replayed: true, becameCaptured: false })
    expect(provider.calls).toHaveLength(1)
    const [o] = await owner.select().from(order).where(eq(order.id, first.orderId))
    expect(o?.cartId).toBe(cartId)
    // Numbers come from `store_counter` (0177), not the store row.
    const [n] = await owner.select().from(storeCounter).where(eq(storeCounter.storeId, storeId))
    expect(n?.value).toBe(2)
  })

  it('the database refuses a second order for the same cart', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const { orderId } = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new FakePaymentProvider(),
    })
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    if (!o) throw new Error('seed')
    const { id: _id, ...copy } = o
    await expect(owner.insert(order).values({ ...copy, number: 99 })).rejects.toThrow()
  })
})

describe('placeOrder outbox', () => {
  it('writes exactly one order.placed row, in the same transaction as the order', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const cod = new FakePaymentProvider({ mode: 'capture', id: 'cod' })
    const { orderId } = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: cod }),
    )
    const rows = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      type: 'order.placed',
      payload: { orderId },
      dispatchedAt: null,
    })
  })

  it('a replayed submit of the same cart writes no second row', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const cod = new FakePaymentProvider({ mode: 'capture', id: 'cod' })
    const submit = () =>
      withStore(app, storeId, (tx) => placeOrder({ storeId, tx }, { cartId, paymentProvider: cod }))
    const first = await submit()
    const second = await submit()

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    const rows = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    expect(rows).toHaveLength(1)
  })

  it('a rolled-back placeOrder (OutOfStock) writes no outbox row', async () => {
    const { storeId, cartId } = await seed({ onHand: 1, quantity: 2 })
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
      ),
    ).rejects.toBeInstanceOf(OutOfStock)
    const rows = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    expect(rows).toHaveLength(0)
  })

  it('a gateway capture at checkout writes order.paid, via applyPaymentStatus after commit', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const provider = new FakePaymentProvider({ mode: 'capture' })
    const { orderId, becameCaptured } = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: provider,
    })
    expect(becameCaptured).toBe(true)
    const rows = await owner
      .select({ type: outboxEvent.type, payload: outboxEvent.payload })
      .from(outboxEvent)
      .where(eq(outboxEvent.storeId, storeId))
    expect(rows.map((r) => r.type).sort()).toEqual(['order.paid', 'order.placed'])
    // One confirmation: the shopper hears from order.placed, not from order.paid as well.
    expect(rows.find((r) => r.type === 'order.placed')?.payload).toEqual({ orderId })
    expect(rows.find((r) => r.type === 'order.paid')?.payload).toEqual({
      orderId,
      notifyCustomer: false,
    })
  })

  it('tells nobody about a gateway checkout whose payment window was closed', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
    )
    const rows = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    expect(rows).toHaveLength(0)
  })
})

describe('placeOrder with the COD & RTO app', () => {
  const checkout = {
    name: 'Asha',
    email: 'asha@example.com',
    phone: '9999999999',
    address: { line1: 'Near temple', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
  }

  it('scores the order and asks a COD shopper to confirm', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await owner
      .update(store)
      .set({ apps: { installed: ['cod-rto'] } })
      .where(eq(store.id, storeId))
    const { orderId } = await withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        {
          cartId,
          paymentProvider: new FakePaymentProvider({ mode: 'capture', id: 'cod' }),
          checkout,
        },
      ),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    // First order (+10), short address with no number (+20): 30, medium.
    expect(o?.rtoRisk).toMatchObject({ score: 30, level: 'medium' })
    expect(o?.codVerification).toBe('pending')
    const types = (
      await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    ).map((r) => r.type)
    expect(types).toEqual(expect.arrayContaining(['order.cod_confirm_requested', 'order.placed']))
  })

  it('refuses COD for a high-risk order when the store hides it, before anything is made', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    await owner
      .update(store)
      .set({
        apps: {
          installed: ['cod-rto'],
          settings: {
            'cod-rto': { risk: { mediumAt: 10, highAt: 20 }, rules: { hideCodForHighRisk: true } },
          },
        },
      })
      .where(eq(store.id, storeId))
    const run = withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        {
          cartId,
          paymentProvider: new FakePaymentProvider({ mode: 'capture', id: 'cod' }),
          checkout,
        },
      ),
    )
    await expect(run).rejects.toMatchObject({ rule: 'cod_high_risk' })
    expect(await owner.select().from(order)).toEqual([])
  })

  it('does nothing when the app is not installed', async () => {
    const { storeId, cartId } = await seed({ onHand: 5, quantity: 1 })
    const { orderId } = await withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        {
          cartId,
          paymentProvider: new FakePaymentProvider({ mode: 'capture', id: 'cod' }),
          checkout,
        },
      ),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.rtoRisk).toBeNull()
    expect(o?.codVerification).toBeNull()
  })
})

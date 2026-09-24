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
import { NotLaunchedYet, OutOfStock } from '../errors'
import { FakePaymentProvider } from '../providers/payment'
import { fulfilOrderLines } from './fulfil'
import { placeOrder, placeOrderAndPay } from './place-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type ProductPreorderOpts = {
  onHand?: number
  preorderEnabled?: boolean
  preorderLimit?: number | null
  preorderPaymentMode?: 'full' | 'fixed' | 'percentage'
  preorderDepositPaise?: number | null
  preorderDepositPercent?: number | null
  launchAt?: Date | null
  pricePaise?: number
}

async function seedProduct(storeId: string, opts: ProductPreorderOpts = {}) {
  const [p] = await owner
    .insert(product)
    .values({
      storeId,
      handle: `preorder-${Math.random().toString(36).slice(2)}`,
      title: 'Gadget',
      status: 'active',
      preorderEnabled: opts.preorderEnabled ?? false,
      preorderLimit: opts.preorderLimit ?? null,
      preorderPaymentMode: opts.preorderPaymentMode ?? 'full',
      preorderDepositPaise: opts.preorderDepositPaise ?? null,
      preorderDepositPercent: opts.preorderDepositPercent ?? null,
      launchAt: opts.launchAt ?? null,
    })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p.id, title: 'Default', pricePaise: opts.pricePaise ?? 100000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId, variantId: v.id, onHand: opts.onHand ?? 0 })
  return { productId: p.id, variantId: v.id }
}

async function seedStore(slug = `store-${Math.random().toString(36).slice(2)}`) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function seedCart(storeId: string, variantId: string, quantity: number, price: number) {
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId, cartId: c.id, variantId, quantity, unitPricePaise: price, preorder: true })
  return c.id
}

beforeEach(async () => {
  await resetDb(owner)
})

describe('pre-order purchasing beyond stock', () => {
  it('sells beyond stock up to the pre-order limit', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, {
      onHand: 2,
      preorderEnabled: true,
      preorderLimit: 5,
    })
    const cartId = await seedCart(storeId, variantId, 6, 100000) // 2 in stock + 4 pre-ordered, limit 5 covers it
    const result = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
    )
    const [inv] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(inv?.reserved).toBe(6)
    expect(result.orderId).toBeTruthy()
  })

  it('refuses beyond the pre-order limit', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, {
      onHand: 2,
      preorderEnabled: true,
      preorderLimit: 3,
    })
    // 2 in stock + would need 4 pre-ordered units, but the limit only allows 3
    const cartId = await seedCart(storeId, variantId, 6, 100000)
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
      ),
    ).rejects.toThrow(OutOfStock)
  })

  it('without pre-order, still refuses beyond stock', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, { onHand: 2, preorderEnabled: false })
    const cartId = await seedCart(storeId, variantId, 3, 100000)
    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
      ),
    ).rejects.toThrow(OutOfStock)
  })

  it('unlimited pre-order (no limit) sells any quantity beyond stock', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, {
      onHand: 0,
      preorderEnabled: true,
      preorderLimit: null,
    })
    const cartId = await seedCart(storeId, variantId, 500, 100000)
    const result = await withStore(app, storeId, (tx) =>
      placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
    )
    expect(result.orderId).toBeTruthy()
  })
})

describe('pre-order deposits', () => {
  it('charges only the fixed deposit and records the balance due', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, {
      onHand: 10,
      preorderEnabled: true,
      preorderLimit: 10,
      preorderPaymentMode: 'fixed',
      preorderDepositPaise: 20000, // 200 rupees deposit per unit
      pricePaise: 100000,
    })
    const cartId = await seedCart(storeId, variantId, 2, 100000)
    const provider = new FakePaymentProvider({ mode: 'capture' })
    const result = await placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider })

    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.totalPaise).toBe(200000)
    expect(o?.depositPaise).toBe(40000) // 20000 * 2 units
    expect(o?.balanceDuePaise).toBe(160000)
    expect(o?.tags).toContain('pre-order')

    const [pay] = await owner.select().from(payment).where(eq(payment.orderId, result.orderId))
    expect(pay?.amountPaise).toBe(40000)

    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, result.orderId))
    expect(lines[0]?.preorder).toBe(true)
  })

  it('charges only the percentage deposit and rounds to the nearest paise', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, {
      onHand: 10,
      preorderEnabled: true,
      preorderLimit: 10,
      preorderPaymentMode: 'percentage',
      preorderDepositPercent: 25,
      pricePaise: 333333,
    })
    const cartId = await seedCart(storeId, variantId, 1, 333333)
    const provider = new FakePaymentProvider({ mode: 'capture' })
    const result = await placeOrderAndPay(app, storeId, { cartId, paymentProvider: provider })

    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.depositPaise).toBe(Math.round((333333 * 25) / 100))
    expect(o?.balanceDuePaise).toBe(333333 - Math.round((333333 * 25) / 100))
  })

  it('full mode charges everything now with no balance due', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, {
      onHand: 10,
      preorderEnabled: true,
      preorderPaymentMode: 'full',
      pricePaise: 50000,
    })
    const cartId = await seedCart(storeId, variantId, 1, 50000)
    const result = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new FakePaymentProvider({ mode: 'capture' }),
    })
    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.depositPaise).toBe(50000)
    expect(o?.balanceDuePaise).toBe(0)
  })
})

describe('fulfilment blocked while balance due', () => {
  it('refuses to fulfil an order with a balance due, and allows it once cleared', async () => {
    const storeId = await seedStore()
    const { variantId } = await seedProduct(storeId, {
      onHand: 10,
      preorderEnabled: true,
      preorderPaymentMode: 'fixed',
      preorderDepositPaise: 10000,
      pricePaise: 50000,
    })
    const cartId = await seedCart(storeId, variantId, 1, 50000)
    const result = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new FakePaymentProvider({ mode: 'capture' }),
    })
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, result.orderId))
    if (!line) throw new Error('no line')

    await expect(
      withStore(app, storeId, (tx) =>
        fulfilOrderLines(
          { storeId, tx },
          { orderId: result.orderId, lines: [{ lineId: line.id, quantity: 1 }] },
        ),
      ),
    ).rejects.toThrow(/balance/i)

    // Clear the balance the way a later PR's collection flow would.
    await owner.update(order).set({ balancePaidAt: new Date() }).where(eq(order.id, result.orderId))

    const fulfilled = await withStore(app, storeId, (tx) =>
      fulfilOrderLines(
        { storeId, tx },
        { orderId: result.orderId, lines: [{ lineId: line.id, quantity: 1 }] },
      ),
    )
    expect(fulfilled.complete).toBe(true)
  })
})

describe('launch countdown enforcement', () => {
  it('refuses to place an order before launch, and allows it after', async () => {
    const storeId = await seedStore()
    const future = new Date(Date.now() + 60 * 60 * 1000)
    const { variantId } = await seedProduct(storeId, { onHand: 10, launchAt: future })
    const cartId = await seedCart(storeId, variantId, 1, 100000)

    await expect(
      withStore(app, storeId, (tx) =>
        placeOrder({ storeId, tx }, { cartId, paymentProvider: new FakePaymentProvider() }),
      ),
    ).rejects.toThrow(NotLaunchedYet)

    const past = new Date(Date.now() - 60 * 60 * 1000)
    const { variantId: launchedVariant } = await seedProduct(storeId, {
      onHand: 10,
      launchAt: past,
    })
    const launchedCart = await seedCart(storeId, launchedVariant, 1, 100000)
    const result = await withStore(app, storeId, (tx) =>
      placeOrder(
        { storeId, tx },
        { cartId: launchedCart, paymentProvider: new FakePaymentProvider() },
      ),
    )
    expect(result.orderId).toBeTruthy()
  })
})

describe('store isolation', () => {
  it("one store's pre-order oversell never touches another store's inventory or limit", async () => {
    const storeA = await seedStore()
    const storeB = await seedStore()
    const a = await seedProduct(storeA, { onHand: 1, preorderEnabled: true, preorderLimit: 2 })
    const b = await seedProduct(storeB, { onHand: 1, preorderEnabled: true, preorderLimit: 2 })

    const cartA = await seedCart(storeA, a.variantId, 3, 100000) // 1 stock + 2 preorder = at the limit
    await withStore(app, storeA, (tx) =>
      placeOrder(
        { storeId: storeA, tx },
        { cartId: cartA, paymentProvider: new FakePaymentProvider() },
      ),
    )

    const [invB] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, b.variantId))
    expect(invB?.reserved).toBe(0)

    // Store B can still place its own order up to its own limit, unaffected by A's oversell.
    const cartB = await seedCart(storeB, b.variantId, 3, 100000)
    const resultB = await withStore(app, storeB, (tx) =>
      placeOrder(
        { storeId: storeB, tx },
        { cartId: cartB, paymentProvider: new FakePaymentProvider() },
      ),
    )
    expect(resultB.orderId).toBeTruthy()
  })
})

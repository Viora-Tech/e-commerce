import {
  cart,
  cartLine,
  createDb,
  customer,
  discount,
  discountUsage,
  order,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../catalog/products'
import { createCollection } from '../collections/service'
import { placeOrder } from '../order/place-order'
import { FakePaymentProvider } from '../providers/payment'
import { checkDiscountCode, loadDiscountCart, resolveCartDiscount } from './resolve'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type Seed = {
  storeId: string
  cartId: string
  mouseId: string
  keyboardId: string
  stickerId: string
  miceId: string
  razerId: string
}

/**
 * A cart with a mouse (manual "Mice" collection), a Razer keyboard (automatic
 * "Razer" collection, vendor rule) and a sticker in no collection.
 */
async function seed(): Promise<Seed> {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  const storeId = s?.id as string
  const ids = await withStore(app, storeId, async (tx) => {
    const product = (title: string, vendor: string, pricePaise: number) =>
      createProduct(tx, storeId, {
        title,
        vendor,
        status: 'active',
        options: [],
        variants: [{ optionValues: [], pricePaise }],
      })
    const mouseId = await product('Mouse', 'Logitech', 100_000)
    const keyboardId = await product('Keyboard', 'Razer', 200_000)
    const stickerId = await product('Sticker', 'Waimers', 10_000)
    const miceId = await createCollection(tx, storeId, {
      title: 'Mice',
      kind: 'manual',
      productIds: [mouseId],
    })
    const razerId = await createCollection(tx, storeId, {
      title: 'Razer',
      kind: 'automatic',
      rules: { match: 'all', conditions: [{ field: 'vendor', op: 'eq', value: 'Razer' }] },
    })
    return { mouseId, keyboardId, stickerId, miceId, razerId }
  })
  // No stock is seeded; untracked variants let placeOrder run.
  await owner.update(variant).set({ trackInventory: false }).where(eq(variant.storeId, storeId))
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  const cartId = c?.id as string
  for (const [productId, pricePaise] of [
    [ids.mouseId, 100_000],
    [ids.keyboardId, 200_000],
    [ids.stickerId, 10_000],
  ] as const) {
    const [v] = await owner.select().from(variant).where(eq(variant.productId, productId))
    await owner.insert(cartLine).values({
      storeId,
      cartId,
      variantId: v?.id as string,
      quantity: 1,
      unitPricePaise: pricePaise,
    })
  }
  return { storeId, cartId, ...ids }
}

async function collectionCode(storeId: string, code: string, ids: string[], value: number) {
  await owner.insert(discount).values({
    storeId,
    title: code,
    kind: 'code',
    code,
    method: 'percent',
    value,
    appliesTo: 'collections',
    appliesToIds: ids,
  })
}

describe('collection-scoped discounts', () => {
  it('loads each line with its manual and automatic collections', async () => {
    const s = await seed()
    const dc = await withStore(app, s.storeId, (tx) =>
      loadDiscountCart({ storeId: s.storeId, tx }, s.cartId),
    )
    const byProduct = new Map(dc.lines.map((l) => [l.productId, l.collectionIds]))
    expect(byProduct.get(s.mouseId)).toEqual([s.miceId])
    expect(byProduct.get(s.keyboardId)).toEqual([s.razerId])
    expect(byProduct.get(s.stickerId)).toEqual([])
  })

  it('discounts only the lines in the named collections', async () => {
    const s = await seed()
    await collectionCode(s.storeId, 'MICE10', [s.miceId], 1000)
    await collectionCode(s.storeId, 'GEAR20', [s.miceId, s.razerId], 2000)
    const check = (code: string) =>
      withStore(app, s.storeId, (tx) =>
        checkDiscountCode({ storeId: s.storeId, tx }, s.cartId, code),
      )

    const mice = await check('MICE10')
    const gear = await check('GEAR20')

    expect(mice.ok && mice.outcome.amountPaise).toBe(10_000)
    expect(gear.ok && gear.outcome.amountPaise).toBe(60_000)
  })

  it('rejects a collection code when nothing in the cart is in the collection', async () => {
    const s = await seed()
    const other = await withStore(app, s.storeId, (tx) =>
      createCollection(tx, s.storeId, { title: 'Headsets', kind: 'manual', productIds: [] }),
    )
    await collectionCode(s.storeId, 'HEADSETS', [other], 1000)
    const r = await withStore(app, s.storeId, (tx) =>
      checkDiscountCode({ storeId: s.storeId, tx }, s.cartId, 'HEADSETS'),
    )
    expect(r).toEqual({ ok: false, reason: 'not_applicable' })
  })

  it('placeOrder charges the collection discount', async () => {
    const s = await seed()
    await collectionCode(s.storeId, 'RAZER15', [s.razerId], 1500)
    const result = await withStore(app, s.storeId, (tx) =>
      placeOrder(
        { storeId: s.storeId, tx },
        { cartId: s.cartId, paymentProvider: new FakePaymentProvider(), discountCode: 'RAZER15' },
      ),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o).toMatchObject({
      discountCode: 'RAZER15',
      discountPaise: 30_000,
      totalPaise: 280_000,
    })
  })
})

describe('a different amount for each product', () => {
  it('placeOrder charges each product its own amount per unit', async () => {
    const s = await seed()
    // Two mice in the cart: ₹200 off each mouse, ₹300 off the keyboard, nothing on the sticker.
    await owner.update(cartLine).set({ quantity: 2 }).where(eq(cartLine.unitPricePaise, 100_000))
    await owner.insert(discount).values({
      storeId: s.storeId,
      title: 'Killtoned',
      kind: 'code',
      code: 'KILLTONED',
      method: 'fixed',
      value: 0,
      appliesTo: 'products',
      appliesToIds: [s.mouseId, s.keyboardId],
      productValues: { [s.mouseId]: 20_000, [s.keyboardId]: 30_000 },
    })
    const check = await withStore(app, s.storeId, (tx) =>
      checkDiscountCode({ storeId: s.storeId, tx }, s.cartId, 'killtoned'),
    )
    expect(check.ok && check.outcome.amountPaise).toBe(70_000)

    const result = await withStore(app, s.storeId, (tx) =>
      placeOrder(
        { storeId: s.storeId, tx },
        { cartId: s.cartId, paymentProvider: new FakePaymentProvider(), discountCode: 'KILLTONED' },
      ),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o).toMatchObject({
      discountCode: 'KILLTONED',
      discountPaise: 70_000,
      subtotalPaise: 410_000,
      totalPaise: 340_000,
    })
  })
})

describe('combinations and customer eligibility', () => {
  it('stacks a product code with an automatic order discount and counts a use of each', async () => {
    const s = await seed()
    const stack = { products: true, order: true, shipping: true }
    await owner.insert(discount).values([
      {
        storeId: s.storeId,
        title: 'Mouse 10',
        type: 'products',
        kind: 'code',
        code: 'MOUSE10',
        method: 'percent',
        value: 1000,
        appliesTo: 'products',
        appliesToIds: [s.mouseId],
        combinesWith: stack,
      },
      {
        storeId: s.storeId,
        title: 'Order 100',
        type: 'order',
        kind: 'automatic',
        method: 'fixed',
        value: 10_000,
        combinesWith: stack,
      },
    ])
    const result = await withStore(app, s.storeId, (tx) =>
      placeOrder(
        { storeId: s.storeId, tx },
        { cartId: s.cartId, paymentProvider: new FakePaymentProvider(), discountCode: 'MOUSE10' },
      ),
    )
    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    // ₹100 off the mouse, then ₹100 off the order.
    expect(o).toMatchObject({ discountCode: 'MOUSE10', discountPaise: 20_000 })
    const uses = await owner
      .select()
      .from(discountUsage)
      .where(eq(discountUsage.orderId, o?.id as string))
    expect(uses.map((u) => u.amountPaise).sort()).toEqual([10_000, 10_000])
  })

  it('limits a code to picked customers once the email is known', async () => {
    const s = await seed()
    const [c] = await owner
      .insert(customer)
      .values({ storeId: s.storeId, email: 'vip@example.com', name: 'VIP' })
      .returning()
    await owner.insert(discount).values({
      storeId: s.storeId,
      title: 'VIP',
      kind: 'code',
      code: 'VIP',
      method: 'percent',
      value: 1000,
      customerEligibility: 'customers',
      eligibleIds: [c?.id as string],
    })
    const check = (email?: string) =>
      withStore(app, s.storeId, (tx) =>
        resolveCartDiscount({ storeId: s.storeId, tx }, s.cartId, 'VIP', { email }),
      )
    expect((await check()).outcome?.amountPaise).toBe(31_000)
    expect((await check('vip@example.com')).outcome?.amountPaise).toBe(31_000)
    expect(await check('someone@example.com')).toMatchObject({
      outcome: null,
      codeRejected: 'not_eligible',
    })
  })
})

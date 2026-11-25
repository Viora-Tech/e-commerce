/** SOURCE OF TRUTH: one-per-customer codes by email or phone — WHAT: a shopper who used a one-per-customer code cannot use it again with another email but the same Indian mobile (any spelling: +91, 0, spaces), and a cancelled order gives the use back / WHY: owner decision 24 Nov 2026, a new email per order was enough to reuse a welcome code */
import {
  cart,
  cartLine,
  createDb,
  discount,
  discountUsage,
  inventoryLevel,
  order,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { DiscountCodeRefused } from '../errors'
import { placeOrderAndPay } from '../order/place-order'
import { cancelOrder } from '../order/status'
import { CodPaymentProvider } from '../providers/cod'
import { checkDiscountCode } from './resolve'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

type Shop = { storeId: string; variantId: string; discountId: string }

async function seedShop(): Promise<Shop> {
  const [s] = await owner
    .insert(store)
    // No "same items again" question: these tests repeat one basket on purpose.
    .values({ slug: 'waimers', name: 'Waimers', payments: { duplicateCheckoutHours: 0 } })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glass pad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 200_000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  const [d] = await owner
    .insert(discount)
    .values({
      storeId: s.id,
      title: 'Welcome 10% off',
      kind: 'code',
      code: 'WELCOME10',
      method: 'percent',
      value: 1000,
      usagePerCustomer: 1,
    })
    .returning()
  if (!d) throw new Error('seed')
  return { storeId: s.id, variantId: v.id, discountId: d.id }
}

async function cartWithCode(shop: Shop): Promise<string> {
  const [c] = await owner
    .insert(cart)
    .values({ storeId: shop.storeId, discountCode: 'WELCOME10' })
    .returning()
  if (!c) throw new Error('seed')
  await owner.insert(cartLine).values({
    storeId: shop.storeId,
    cartId: c.id,
    variantId: shop.variantId,
    quantity: 1,
    unitPricePaise: 200_000,
  })
  return c.id
}

const codOrder = async (shop: Shop, email: string, phone: string) =>
  placeOrderAndPay(app, shop.storeId, {
    cartId: await cartWithCode(shop),
    paymentProvider: new CodPaymentProvider(),
    checkout: {
      name: 'Test Shopper',
      email,
      phone,
      address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
    },
  })

const check = async (shop: Shop, email: string, phone: string) =>
  withStore(app, shop.storeId, async (tx) =>
    checkDiscountCode({ storeId: shop.storeId, tx }, await cartWithCode(shop), 'WELCOME10', {
      email,
      phone,
    }),
  )

const usedCount = async (id: string) =>
  (await owner.select().from(discount).where(eq(discount.id, id)))[0]?.usedCount

describe('a one-per-customer code', () => {
  it('is refused for another email with the same mobile number, however it is written', async () => {
    const shop = await seedShop()
    await codOrder(shop, 'first@example.com', '9876543210')
    expect(await usedCount(shop.discountId)).toBe(1)

    for (const phone of ['+91 98765 43210', '09876543210', '919876543210', '98765 43210']) {
      expect(await check(shop, 'second@example.com', phone)).toEqual({
        ok: false,
        reason: 'limit_reached',
      })
    }
    await expect(codOrder(shop, 'second@example.com', '+91 98765 43210')).rejects.toBeInstanceOf(
      DiscountCodeRefused,
    )
    expect(await usedCount(shop.discountId)).toBe(1)
  })

  it('still works for a different email and a different number', async () => {
    const shop = await seedShop()
    await codOrder(shop, 'first@example.com', '9876543210')
    expect((await check(shop, 'other@example.com', '9123456780')).ok).toBe(true)
  })

  it('is still refused for the same email with a new number', async () => {
    const shop = await seedShop()
    await codOrder(shop, 'first@example.com', '9876543210')
    expect(await check(shop, 'FIRST@example.com', '9123456780')).toEqual({
      ok: false,
      reason: 'limit_reached',
    })
  })

  it('matches an earlier order whose number was saved with +91', async () => {
    const shop = await seedShop()
    const first = await codOrder(shop, 'first@example.com', '9876543210')
    // An earlier order written with +91: the same number.
    await owner.update(order).set({ phone: '+919876543210' }).where(eq(order.id, first.orderId))
    expect((await check(shop, 'second@example.com', '9876543210')).ok).toBe(false)
  })
})

describe('cancelling an order with a code', () => {
  it('gives the use back: the total and the shopper, once however often it is cancelled', async () => {
    const shop = await seedShop()
    await owner.update(discount).set({ usedCount: 4 }).where(eq(discount.id, shop.discountId))
    const placed = await codOrder(shop, 'first@example.com', '9876543210')
    expect(await usedCount(shop.discountId)).toBe(5)

    const ctx = (tx: Parameters<Parameters<typeof withStore>[2]>[0]) => ({
      storeId: shop.storeId,
      tx,
    })
    await withStore(app, shop.storeId, (tx) =>
      cancelOrder(ctx(tx), placed.orderId, { notifyCustomer: false }),
    )
    expect(await usedCount(shop.discountId)).toBe(4)
    // The use stays listed against the order, no longer counted.
    const uses = await owner
      .select()
      .from(discountUsage)
      .where(eq(discountUsage.orderId, placed.orderId))
    expect(uses).toMatchObject([{ counted: false }])
    expect((await check(shop, 'first@example.com', '9876543210')).ok).toBe(true)

    // A second cancel changes nothing.
    await withStore(app, shop.storeId, (tx) =>
      cancelOrder(ctx(tx), placed.orderId, { notifyCustomer: false }),
    )
    expect(await usedCount(shop.discountId)).toBe(4)
  })
})

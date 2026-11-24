/** SOURCE OF TRUTH: a coupon on a split tender order — WHAT: store credit + gateway places the order at once, so its code counts at once; when the gateway payment fails and the unpaid order expires (is cancelled), the use is given back / WHY: owner decision 24 Nov 2026, a failed payment must not use up the shopper's code */
import {
  cart,
  cartLine,
  createDb,
  customer,
  discount,
  discountUsage,
  inventoryLevel,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { expireUnpaidOrder } from '../payments/expiry'
import { FakePaymentProvider } from '../providers/payment'
import { changeStoreCredit } from './store-credit'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const EMAIL = 'credit@example.com'

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 300_000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 10 })
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: EMAIL, name: 'Test Shopper' })
    .returning()
  if (!cu) throw new Error('seed')
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
  await withStore(app, s.id, (tx) =>
    changeStoreCredit(
      { storeId: s.id, tx },
      { customerId: cu.id, amountPaise: 50_000, kind: 'adjustment', reason: 'Test credit' },
    ),
  )
  const [c] = await owner
    .insert(cart)
    .values({ storeId: s.id, discountCode: 'WELCOME10' })
    .returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId: s.id, cartId: c.id, variantId: v.id, quantity: 1, unitPricePaise: 300_000 })
  return { storeId: s.id, customerId: cu.id, discountId: d.id, cartId: c.id }
}

describe('a code on a split tender order', () => {
  it('is given back when the gateway payment fails and the order expires unpaid', async () => {
    const { storeId, customerId, discountId, cartId } = await seed()
    const failing = new FakePaymentProvider({ mode: 'fail' })
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: failing,
      checkout: {
        name: 'Test Shopper',
        email: EMAIL,
        phone: '9876501234',
        address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
      },
      storeCredit: { customerId },
    })
    expect(r.paymentError).not.toBeNull()
    const usedCount = async () =>
      (await owner.select().from(discount).where(eq(discount.id, discountId)))[0]?.usedCount
    // Split tender is an order at once, not a draft: the code counted when it was placed.
    expect(await usedCount()).toBe(1)

    const out = await expireUnpaidOrder(app, storeId, r.orderId, [failing], 30)
    expect(out.result).toBe('cancelled')
    expect(await usedCount()).toBe(0)
    const uses = await owner
      .select()
      .from(discountUsage)
      .where(eq(discountUsage.orderId, r.orderId))
    expect(uses).toMatchObject([{ counted: false }])
  })
})

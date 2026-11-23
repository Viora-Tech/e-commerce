/** SOURCE OF TRUTH: tests for codes on unpaid checkout drafts — WHAT: an online checkout's code is only noted while the draft is unpaid, counts when the payment is captured, and expiring the draft gives nothing back that was never counted / WHY: a failed payment used to use up the shopper's one-per-customer code for up to 7 days */
import {
  cart,
  cartLine,
  createDb,
  discount,
  discountUsage,
  inventoryLevel,
  order,
  orderNote,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { OVER_LIMIT_NOTE } from '../discounts/usage'
import { applyPaymentStatus } from '../payments/confirm'
import { GatewayDouble } from '../payments/gateway-double.test-util'
import { expireCheckoutDrafts } from './checkout-draft'
import { placeOrderAndPay } from './place-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

type Shop = { storeId: string; keyboard: string; pad: string; discountId: string }

async function seedShop(): Promise<Shop> {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'waimers', name: 'Waimers', payments: { unpaidAsDrafts: 'on' } })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'keyboard', title: 'Keyboard', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [keyboard, pad] = await owner
    .insert(variant)
    .values([
      { storeId: s.id, productId: p.id, title: 'Keyboard', pricePaise: 500000 },
      { storeId: s.id, productId: p.id, title: 'Pad', pricePaise: 100000 },
    ])
    .returning()
  if (!keyboard || !pad) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: keyboard.id, onHand: 10 },
    { storeId: s.id, variantId: pad.id, onHand: 10 },
  ])
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
  return { storeId: s.id, keyboard: keyboard.id, pad: pad.id, discountId: d.id }
}

async function checkoutWithCode(shop: Shop, variantId: string, unitPricePaise: number) {
  const [c] = await owner
    .insert(cart)
    .values({ storeId: shop.storeId, discountCode: 'WELCOME10' })
    .returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values({ storeId: shop.storeId, cartId: c.id, variantId, quantity: 1, unitPricePaise })
  return placeOrderAndPay(app, shop.storeId, {
    cartId: c.id,
    paymentProvider: new GatewayDouble(),
    checkout: {
      name: 'Shopper',
      email: 'rudra@example.com',
      phone: '9876543210',
      address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
    },
  })
}

const usedCount = async (id: string) =>
  (await owner.select().from(discount).where(eq(discount.id, id)))[0]?.usedCount

const usesOf = (orderId: string) =>
  owner.select().from(discountUsage).where(eq(discountUsage.orderId, orderId))

describe('a code on an unpaid checkout draft', () => {
  it('is noted, not counted, until the payment is captured', async () => {
    const shop = await seedShop()
    const first = await checkoutWithCode(shop, shop.keyboard, 500000)
    expect(await usedCount(shop.discountId)).toBe(0)
    expect(await usesOf(first.orderId)).toMatchObject([{ counted: false, amountPaise: 50000 }])

    // Payment failed or was abandoned: the same shopper can still use their one-per-customer
    // code on a new checkout with other items.
    const second = await checkoutWithCode(shop, shop.pad, 100000)
    const [o2] = await owner.select().from(order).where(eq(order.id, second.orderId))
    expect(o2).toMatchObject({ discountCode: 'WELCOME10', discountPaise: 10000 })

    if (!second.attemptId) throw new Error('attempt')
    await withStore(app, shop.storeId, (tx) =>
      applyPaymentStatus(
        { storeId: shop.storeId, tx },
        { paymentId: second.attemptId as string, status: 'captured', providerPaymentId: 'pay_2' },
      ),
    )
    expect(await usedCount(shop.discountId)).toBe(1)
    expect(await usesOf(second.orderId)).toMatchObject([{ counted: true }])
    // The first draft's use still does not count.
    expect(await usesOf(first.orderId)).toMatchObject([{ counted: false }])

    // The shopper pays the first draft too: already paid at the discounted price, so it is
    // kept and counted, with a timeline note that the one-per-customer cap was passed.
    if (!first.attemptId) throw new Error('attempt')
    await withStore(app, shop.storeId, (tx) =>
      applyPaymentStatus(
        { storeId: shop.storeId, tx },
        { paymentId: first.attemptId as string, status: 'captured', providerPaymentId: 'pay_1' },
      ),
    )
    expect(await usedCount(shop.discountId)).toBe(2)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, first.orderId))
    expect(notes.map((n) => n.body)).toContain(OVER_LIMIT_NOTE('WELCOME10'))
  })

  it('expiring the draft gives back nothing it never counted', async () => {
    const shop = await seedShop()
    const r = await checkoutWithCode(shop, shop.keyboard, 500000)
    const old = new Date(Date.now() - 8 * 86_400_000)
    await owner.update(order).set({ lastActivityAt: old }).where(eq(order.id, r.orderId))
    await owner.update(discount).set({ usedCount: 3 }).where(eq(discount.id, shop.discountId))

    await withStore(app, shop.storeId, (tx) => expireCheckoutDrafts({ storeId: shop.storeId, tx }))
    expect(await usesOf(r.orderId)).toHaveLength(0)
    expect(await usedCount(shop.discountId)).toBe(3)
  })
})

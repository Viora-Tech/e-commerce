/** SOURCE OF TRUTH: tests for repeated checkouts — WHAT: `placeOrder` refuses the same items still unpaid, asks before the same items placed, caps unpaid checkouts per hour, and allows one unpaid manual transfer per shopper / WHY: these rules decide whether an order exists at all */
import {
  cart,
  cartLine,
  createDb,
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
import { GatewayDouble } from '../payments/gateway-double.test-util'
import { ManualPaymentProvider } from '../providers/manual'
import { FakePaymentProvider, type PaymentProvider } from '../providers/payment'
import { DuplicateCheckout, itemsKey, TooManyUnpaidCheckouts } from './duplicate-checkout'
import { placeOrderAndPay } from './place-order'
import { cancelOrder } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const transfer = new ManualPaymentProvider({ upiId: 'shop@hdfcbank', payeeName: 'Shop' })
/** Razorpay-like: the order waits for the gateway's answer. */
const gateway = () => new GatewayDouble()
/** Paid at checkout. */
const paidGateway = () => new FakePaymentProvider({ mode: 'capture' })
const cod = () => new FakePaymentProvider({ mode: 'capture', id: 'cod' })

type Shop = { storeId: string; mouse: string; pad: string }

async function seedShop(payments: unknown = null): Promise<Shop> {
  const [s] = await owner
    .insert(store)
    // These rules guard numbered unpaid orders: drafts off (checkout-draft.test.ts covers drafts).
    .values({
      slug: 'waimers',
      name: 'Waimers',
      payments: { unpaidAsDrafts: 'off', ...(payments as object | null) },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [mouse, pad] = await owner
    .insert(variant)
    .values([
      { storeId: s.id, productId: p.id, title: 'Mouse', pricePaise: 10000 },
      { storeId: s.id, productId: p.id, title: 'Pad', pricePaise: 5000 },
    ])
    .returning()
  if (!mouse || !pad) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: mouse.id, onHand: 100 },
    { storeId: s.id, variantId: pad.id, onHand: 100 },
  ])
  return { storeId: s.id, mouse: mouse.id, pad: pad.id }
}

async function cartWith(shop: Shop, lines: { variantId: string; quantity: number }[]) {
  const [c] = await owner.insert(cart).values({ storeId: shop.storeId }).returning()
  if (!c) throw new Error('seed')
  await owner
    .insert(cartLine)
    .values(
      lines.map((l) => ({ storeId: shop.storeId, cartId: c.id, unitPricePaise: 10000, ...l })),
    )
  return c.id
}

const asha = { email: 'asha@example.com', phone: '9876543210' }
const ravi = { email: 'ravi@example.com', phone: '9123456780' }

function checkout(who: { email: string; phone: string }) {
  return {
    name: 'Shopper',
    ...who,
    address: { line1: '12 MG Road', city: 'Bengaluru', stateCode: 'KA', pincode: '560001' },
  }
}

function place(
  shop: Shop,
  cartId: string,
  provider: PaymentProvider,
  who: { email: string; phone: string },
  orderAgain?: boolean,
) {
  return placeOrderAndPay(app, shop.storeId, {
    cartId,
    paymentProvider: provider,
    checkout: checkout(who),
    ...(orderAgain ? { orderAgain } : {}),
  })
}

const orderCount = async (storeId: string) =>
  (await owner.select({ id: order.id }).from(order).where(eq(order.storeId, storeId))).length

describe('itemsKey', () => {
  it('ignores line order and sums the same variant', () => {
    expect(
      itemsKey([
        { variantId: 'b', quantity: 1 },
        { variantId: 'a', quantity: 2 },
      ]),
    ).toBe(
      itemsKey([
        { variantId: 'a', quantity: 2 },
        { variantId: 'b', quantity: 1 },
      ]),
    )
    expect(
      itemsKey([
        { variantId: 'a', quantity: 1 },
        { variantId: 'a', quantity: 1 },
      ]),
    ).toBe(itemsKey([{ variantId: 'a', quantity: 2 }]))
    expect(itemsKey([{ variantId: 'a', quantity: 1 }])).not.toBe(
      itemsKey([{ variantId: 'a', quantity: 2 }]),
    )
  })
})

describe('the same items, still unpaid', () => {
  it('refuses a second order and points at the first one', async () => {
    const shop = await seedShop()
    const items = [
      { variantId: shop.mouse, quantity: 1 },
      { variantId: shop.pad, quantity: 2 },
    ]
    const first = await place(shop, await cartWith(shop, items), gateway(), asha)
    // Same items in another order, matched by the phone typed another way.
    const again = place(shop, await cartWith(shop, [...items].reverse()), cod(), {
      email: 'other@example.com',
      phone: '+91 98765 43210',
    })
    const err = await again.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DuplicateCheckout)
    expect((err as DuplicateCheckout).kind).toBe('unpaid')
    expect((err as DuplicateCheckout).order.id).toBe(first.orderId)
    // Email matches but phone does not: no guest link.
    expect((err as DuplicateCheckout).sameContact).toBe(false)
    expect(await orderCount(shop.storeId)).toBe(1)
  })

  it('"Order again" does not get past an unpaid one', async () => {
    const shop = await seedShop()
    const items = [{ variantId: shop.mouse, quantity: 1 }]
    await place(shop, await cartWith(shop, items), gateway(), asha)
    await expect(
      place(shop, await cartWith(shop, items), gateway(), asha, true),
    ).rejects.toBeInstanceOf(DuplicateCheckout)
  })

  it('lets a different cart through on another way to pay', async () => {
    const shop = await seedShop()
    await place(
      shop,
      await cartWith(shop, [{ variantId: shop.mouse, quantity: 1 }]),
      gateway(),
      asha,
    )
    await place(
      shop,
      await cartWith(shop, [{ variantId: shop.mouse, quantity: 2 }]),
      gateway(),
      asha,
    )
    expect(await orderCount(shop.storeId)).toBe(2)
  })

  it('does not count a cancelled earlier order', async () => {
    const shop = await seedShop()
    const items = [{ variantId: shop.mouse, quantity: 1 }]
    const first = await place(shop, await cartWith(shop, items), gateway(), asha)
    await withStore(app, shop.storeId, (tx) =>
      cancelOrder({ storeId: shop.storeId, tx }, first.orderId, { notifyCustomer: false }),
    )
    await place(shop, await cartWith(shop, items), gateway(), asha)
    expect(await orderCount(shop.storeId)).toBe(2)
  })

  it('does not affect another shopper', async () => {
    const shop = await seedShop()
    const items = [{ variantId: shop.mouse, quantity: 1 }]
    await place(shop, await cartWith(shop, items), gateway(), asha)
    await place(shop, await cartWith(shop, items), gateway(), ravi)
    expect(await orderCount(shop.storeId)).toBe(2)
  })

  it('looks back only as far as the store says', async () => {
    const shop = await seedShop({ duplicateCheckoutHours: 2 })
    const items = [{ variantId: shop.mouse, quantity: 1 }]
    const first = await place(shop, await cartWith(shop, items), gateway(), asha)
    await owner
      .update(order)
      .set({ placedAt: new Date(Date.now() - 3 * 3_600_000) })
      .where(eq(order.id, first.orderId))
    await place(shop, await cartWith(shop, items), gateway(), asha)
    expect(await orderCount(shop.storeId)).toBe(2)
  })
})

describe('the same items, already paid', () => {
  it('asks before a second order, and places it on "Yes, order again"', async () => {
    const shop = await seedShop()
    const items = [{ variantId: shop.mouse, quantity: 1 }]
    const first = await place(shop, await cartWith(shop, items), paidGateway(), asha)
    const cartId = await cartWith(shop, items)
    const err = await place(shop, cartId, paidGateway(), asha).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DuplicateCheckout)
    expect((err as DuplicateCheckout).kind).toBe('placed')
    expect((err as DuplicateCheckout).order.id).toBe(first.orderId)
    expect((err as DuplicateCheckout).sameContact).toBe(true)
    expect((err as DuplicateCheckout).minutesAgo).toBeGreaterThanOrEqual(1)
    expect(await orderCount(shop.storeId)).toBe(1)
    // The refusal rolled back: the same cart can still be ordered once the shopper confirms.
    await place(shop, cartId, paidGateway(), asha, true)
    expect(await orderCount(shop.storeId)).toBe(2)
  })
})

describe('unpaid checkouts per hour', () => {
  it('is off by default (owner: no hard block)', async () => {
    const shop = await seedShop()
    for (const q of [1, 2, 3, 4]) {
      await place(
        shop,
        await cartWith(shop, [{ variantId: shop.mouse, quantity: q }]),
        gateway(),
        asha,
      )
    }
    expect(await orderCount(shop.storeId)).toBe(4)
  })

  it('when turned on, refuses the 4th unpaid checkout in an hour and names the latest', async () => {
    const shop = await seedShop({ unpaidCheckoutsPerHour: 3 })
    const ids: string[] = []
    for (const q of [1, 2, 3]) {
      ids.push(
        (
          await place(
            shop,
            await cartWith(shop, [{ variantId: shop.mouse, quantity: q }]),
            gateway(),
            asha,
          )
        ).orderId,
      )
    }
    const fourth = place(
      shop,
      await cartWith(shop, [{ variantId: shop.pad, quantity: 1 }]),
      gateway(),
      asha,
    )
    const err = await fourth.catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TooManyUnpaidCheckouts)
    expect((err as TooManyUnpaidCheckouts).latest?.id).toBe(ids[2])
    expect(await orderCount(shop.storeId)).toBe(3)
    // Cash on delivery is never capped, and another shopper is not affected.
    await place(shop, await cartWith(shop, [{ variantId: shop.pad, quantity: 2 }]), cod(), asha)
    await place(shop, await cartWith(shop, [{ variantId: shop.pad, quantity: 1 }]), gateway(), ravi)
    expect(await orderCount(shop.storeId)).toBe(5)
  })

  it('counts cancelled unpaid attempts too, but not paid ones', async () => {
    const shop = await seedShop({ unpaidCheckoutsPerHour: 2 })
    const a = await place(
      shop,
      await cartWith(shop, [{ variantId: shop.mouse, quantity: 1 }]),
      gateway(),
      asha,
    )
    await withStore(app, shop.storeId, (tx) =>
      cancelOrder({ storeId: shop.storeId, tx }, a.orderId, { notifyCustomer: false }),
    )
    await place(
      shop,
      await cartWith(shop, [{ variantId: shop.mouse, quantity: 2 }]),
      paidGateway(),
      asha,
    )
    await place(
      shop,
      await cartWith(shop, [{ variantId: shop.mouse, quantity: 3 }]),
      gateway(),
      asha,
    )
    await expect(
      place(shop, await cartWith(shop, [{ variantId: shop.mouse, quantity: 4 }]), gateway(), asha),
    ).rejects.toBeInstanceOf(TooManyUnpaidCheckouts)
  })
})

describe('unpaid manual transfers are not blocked', () => {
  const setup = async () => {
    const shop = await seedShop()
    const first = await place(
      shop,
      await cartWith(shop, [{ variantId: shop.mouse, quantity: 1 }]),
      transfer,
      asha,
    )
    return { shop, first }
  }
  const otherCart = (shop: Shop) => cartWith(shop, [{ variantId: shop.pad, quantity: 1 }])

  it('does not block a second transfer order with other items (owner: no hard block)', async () => {
    const { shop } = await setup()
    await place(shop, await otherCart(shop), transfer, {
      email: ' ASHA@example.com',
      phone: '9000000000',
    })
    expect(await orderCount(shop.storeId)).toBe(2)
  })

  it('still lets the shopper pay another way', async () => {
    const { shop } = await setup()
    await place(shop, await otherCart(shop), cod(), asha)
    await place(shop, await cartWith(shop, [{ variantId: shop.pad, quantity: 3 }]), gateway(), asha)
    expect(await orderCount(shop.storeId)).toBe(3)
  })

  it('lets a different shopper order by transfer', async () => {
    const { shop } = await setup()
    await place(shop, await otherCart(shop), transfer, ravi)
    expect(await orderCount(shop.storeId)).toBe(2)
  })

  it('does not count an earlier transfer order that was paid or cancelled', async () => {
    const { shop, first } = await setup()
    await owner.update(order).set({ checkoutPaidAt: new Date() }).where(eq(order.id, first.orderId))
    const second = await place(shop, await otherCart(shop), transfer, asha)
    await withStore(app, shop.storeId, (tx) =>
      cancelOrder({ storeId: shop.storeId, tx }, second.orderId, { notifyCustomer: false }),
    )
    await place(shop, await cartWith(shop, [{ variantId: shop.pad, quantity: 2 }]), transfer, asha)
    expect(await orderCount(shop.storeId)).toBe(3)
  })
})

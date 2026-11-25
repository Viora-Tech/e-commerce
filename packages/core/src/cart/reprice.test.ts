/** SOURCE OF TRUTH: cart re-pricing tests — WHAT: a line added at a sale price is charged the live price once the sale ends, in the cart, the checkout and the order, with a note saying the sale ended; a price that drops is passed on quietly / WHY: owner decision 24 Nov 2026, the cart kept the sale price for as long as it lived */
import {
  createDb,
  inventoryLevel,
  order,
  orderLine,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { CodPaymentProvider } from '../providers/cod'
import { addToCart, createCart, getCart } from './cart'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const SALE = 80_000
const FULL = 100_000

async function seedCart() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glass pad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: SALE })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const cartId = await withStore(app, s.id, async (tx) => {
    const ctx = { storeId: s.id, tx }
    const id = await createCart(ctx)
    await addToCart(ctx, id, v.id, 2)
    return id
  })
  return { storeId: s.id, variantId: v.id, cartId }
}

const setPrice = (variantId: string, pricePaise: number) =>
  owner.update(variant).set({ pricePaise }).where(eq(variant.id, variantId))

const cartOf = (storeId: string, cartId: string) =>
  withStore(app, storeId, (tx) => getCart({ storeId, tx }, cartId))

describe('a cart line whose sale ended', () => {
  it('shows the live price and says the sale ended, until the line is added again', async () => {
    const { storeId, variantId, cartId } = await seedCart()
    await setPrice(variantId, FULL)

    const view = await cartOf(storeId, cartId)
    expect(view?.lines[0]).toMatchObject({
      unitPricePaise: FULL,
      linePaise: 2 * FULL,
      saleEndedFromPaise: SALE,
    })
    expect(view?.subtotalPaise).toBe(2 * FULL)
    // Read again: the note stays (the shopper may open the checkout next).
    expect((await cartOf(storeId, cartId))?.lines[0]?.saleEndedFromPaise).toBe(SALE)

    await withStore(app, storeId, (tx) => addToCart({ storeId, tx }, cartId, variantId, 1))
    expect((await cartOf(storeId, cartId))?.lines[0]).toMatchObject({
      quantity: 3,
      unitPricePaise: FULL,
      saleEndedFromPaise: null,
    })
  })

  it('is charged the live price at checkout, even when the cart was not opened since', async () => {
    const { storeId, variantId, cartId } = await seedCart()
    await setPrice(variantId, FULL)
    const r = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new CodPaymentProvider(),
      checkout: {
        name: 'Test Shopper',
        email: 'shopper@example.com',
        phone: '9999999999',
        address: { line1: '1 Street', city: 'Sonipat', stateCode: 'HR', pincode: '131001' },
      },
    })
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, r.orderId))
    expect(line?.unitPricePaise).toBe(FULL)
    const [o] = await owner.select().from(order).where(eq(order.id, r.orderId))
    expect(o?.subtotalPaise).toBe(2 * FULL)
  })

  it('passes a lower price on with no note', async () => {
    const { storeId, variantId, cartId } = await seedCart()
    await setPrice(variantId, 70_000)
    expect((await cartOf(storeId, cartId))?.lines[0]).toMatchObject({
      unitPricePaise: 70_000,
      saleEndedFromPaise: null,
    })
  })
})

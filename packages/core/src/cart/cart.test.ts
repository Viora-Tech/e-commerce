import {
  address,
  createDb,
  customer,
  inventoryLevel,
  media,
  order,
  orderLine,
  product,
  productMedia,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { placeOrderAndPay } from '../order/place-order'
import { CodPaymentProvider } from '../providers/cod'
import { addToCart, createCart, getCart, setLineQuantity } from './cart'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 999900 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  return { storeId: s.id, productId: p.id, variantId: v.id }
}

beforeEach(async () => {
  await resetDb(owner)
})

describe('cart', () => {
  it('adds, merges, updates and removes lines with snapshotted prices', async () => {
    const { storeId, variantId } = await seed()
    const view = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const cartId = await createCart(ctx)
      await addToCart(ctx, cartId, variantId, 1)
      await addToCart(ctx, cartId, variantId, 2)
      const merged = await getCart(ctx, cartId)
      expect(merged?.lines).toHaveLength(1)
      expect(merged?.itemCount).toBe(3)
      expect(merged?.subtotalPaise).toBe(3 * 999900)
      const line = merged?.lines[0]
      await setLineQuantity(ctx, cartId, line?.id as string, 1)
      await setLineQuantity(ctx, cartId, line?.id as string, 0)
      return getCart(ctx, cartId)
    })
    expect(view?.lines).toEqual([])
  })

  it("shows the product's first image on a line whose variant has none", async () => {
    const { storeId, productId, variantId } = await seed()
    const [second, first] = await owner
      .insert(media)
      .values([
        { storeId, url: 'https://cdn.test/side.jpg', alt: null },
        { storeId, url: 'https://cdn.test/front.jpg', alt: null },
      ])
      .returning()
    await owner.insert(productMedia).values([
      { storeId, productId, mediaId: second?.id as string, position: 1 },
      { storeId, productId, mediaId: first?.id as string, position: 0 },
    ])
    const view = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const cartId = await createCart(ctx)
      await addToCart(ctx, cartId, variantId, 1)
      return getCart(ctx, cartId)
    })
    expect(view?.lines[0]?.imageUrl).toBe('https://cdn.test/front.jpg')
  })

  it('checks out with cash on delivery: customer, address, snapshots, pending payment', async () => {
    const { storeId, variantId } = await seed()
    const cartId = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const id = await createCart(ctx)
      await addToCart(ctx, id, variantId, 2)
      return id
    })
    const result = await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new CodPaymentProvider(),
      checkout: {
        email: 'buyer@example.com',
        phone: '9999999999',
        name: 'A Buyer',
        address: { line1: '1 Street', city: 'Sonipat', stateCode: 'HR', pincode: '131001' },
      },
    })
    expect(result.paymentStatus).toBe('pending')
    const [o] = await owner.select().from(order).where(eq(order.id, result.orderId))
    expect(o?.status).toBe('open')
    expect(o?.paymentMethod).toBe('cod')
    expect(o?.email).toBe('buyer@example.com')
    const [c] = await owner
      .select()
      .from(customer)
      .where(eq(customer.id, o?.customerId as string))
    expect(c?.name).toBe('A Buyer')
    const [a] = await owner
      .select()
      .from(address)
      .where(eq(address.id, o?.shippingAddressId as string))
    expect(a?.stateCode).toBe('HR')
    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, result.orderId))
    expect(lines[0]?.title).toBe('Glasspad')
    expect(lines[0]?.variantTitle).toBe('Black')
  })
})

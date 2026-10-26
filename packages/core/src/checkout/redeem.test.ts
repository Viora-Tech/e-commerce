/** SOURCE OF TRUTH: redeemHandoff tests — opens an own-store open cart; refuses foreign-store, empty, and already-ordered carts */
import { createDb, inventoryLevel, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { addToCart, createCart } from '../cart/cart'
import { placeOrderAndPay } from '../order/place-order'
import { CodPaymentProvider } from '../providers/cod'
import { redeemHandoff } from './redeem'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
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
  return { storeId: s.id, variantId: v.id }
}

const openCart = (storeId: string, variantId: string) =>
  withStore(app, storeId, async (tx) => {
    const ctx = { storeId, tx }
    const id = await createCart(ctx)
    await addToCart(ctx, id, variantId, 1)
    return id
  })

const redeem = (storeId: string, payload: { storeId: string; cartId: string }) =>
  withStore(app, storeId, (tx) => redeemHandoff({ storeId, tx }, { ...payload, customerId: null }))

describe('redeemHandoff', () => {
  it('opens an open cart for its own store', async () => {
    const { storeId, variantId } = await seed()
    const cartId = await openCart(storeId, variantId)
    expect(await redeem(storeId, { storeId, cartId })).toEqual({ ok: true, cartId })
  })

  it('refuses a token minted for another store', async () => {
    const { storeId, variantId } = await seed()
    const cartId = await openCart(storeId, variantId)
    expect(await redeem(storeId, { storeId: 'another-store', cartId })).toEqual({
      ok: false,
      reason: 'foreign',
    })
  })

  it('refuses an empty cart', async () => {
    const { storeId } = await seed()
    const cartId = await withStore(app, storeId, (tx) => createCart({ storeId, tx }))
    expect(await redeem(storeId, { storeId, cartId })).toEqual({ ok: false, reason: 'empty' })
  })

  it('refuses a cart already turned into an order (single-use)', async () => {
    const { storeId, variantId } = await seed()
    const cartId = await openCart(storeId, variantId)
    await placeOrderAndPay(app, storeId, {
      cartId,
      paymentProvider: new CodPaymentProvider(),
      checkout: {
        email: 'buyer@example.com',
        phone: '9999999999',
        name: 'A Buyer',
        address: { line1: '1 Street', city: 'Sonipat', stateCode: 'HR', pincode: '131001' },
      },
    })
    expect(await redeem(storeId, { storeId, cartId })).toEqual({ ok: false, reason: 'spent' })
  })
})

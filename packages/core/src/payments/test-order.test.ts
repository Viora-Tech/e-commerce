/** SOURCE OF TRUTH: payment test product hiding — WHAT covers `isSystemTest` on the ₹1 test product / WHY it must be flagged, reused, and excluded from `notSystemTest` while remaining cart-addable by id */
import { cart, cartLine, createDb, product, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { notSystemTest } from '../catalog/system-test'
import { createPaymentTestCart } from './test-order'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('payment test product', () => {
  it('is flagged isSystemTest and excluded by the shared listing filter', async () => {
    const storeId = await seedStore('a')
    await withStore(app, storeId, (tx) => createPaymentTestCart({ storeId, tx }))

    const [row] = await owner
      .select({ isSystemTest: product.isSystemTest, handle: product.handle })
      .from(product)
      .where(eq(product.storeId, storeId))
    expect(row?.handle).toBe('payment-test')
    expect(row?.isSystemTest).toBe(true)

    const visible = await owner.select({ id: product.id }).from(product).where(notSystemTest)
    expect(visible).toHaveLength(0)
  })

  it('reuses the same product/variant on a second call instead of duplicating it', async () => {
    const storeId = await seedStore('b')
    await withStore(app, storeId, (tx) => createPaymentTestCart({ storeId, tx }))
    await withStore(app, storeId, (tx) => createPaymentTestCart({ storeId, tx }))

    const rows = await owner
      .select({ id: product.id })
      .from(product)
      .where(eq(product.storeId, storeId))
    expect(rows).toHaveLength(1)
  })

  it('still lets the test-checkout flow add the hidden product to a cart by id', async () => {
    const storeId = await seedStore('c')
    const cartId = await withStore(app, storeId, (tx) => createPaymentTestCart({ storeId, tx }))

    const lines = await owner.select().from(cartLine).where(eq(cartLine.cartId, cartId))
    expect(lines).toHaveLength(1)
    const [cartRow] = await owner.select().from(cart).where(eq(cart.id, cartId))
    expect(cartRow?.storeId).toBe(storeId)
  })
})

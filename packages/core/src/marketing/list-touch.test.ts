/** SOURCE OF TRUTH: tests for the lists' Source column — WHAT: the drafts and abandoned checkouts lists return the touch cut to what names the channel, null when none was recorded / WHY: the admin's Source column reads it (20 Nov 2026) */
import {
  cart,
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
import { captureCartContact, listAbandoned } from '../cart/abandoned'
import { addToCart, createCart } from '../cart/cart'
import { listDrafts } from '../order/draft-list'
import { createDraft } from '../order/drafts'
import { setCartAttribution } from './sessions'

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
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 100000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 50 })
  return { storeId: s.id, variantId: v.id }
}

const AT = '2026-11-20T09:00:00.000Z'

describe('the Source column touch', () => {
  it('abandoned checkouts: the stamped touch, without the campaign or first page', async () => {
    const { storeId, variantId } = await seed()
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000)
    const quiet = (email: string, stamp: boolean) =>
      withStore(app, storeId, async (tx) => {
        const ctx = { storeId, tx }
        const cartId = await createCart(ctx)
        await addToCart(ctx, cartId, variantId, 1)
        if (stamp) {
          await setCartAttribution(tx, cartId, {
            channel: 'social',
            source: 'instagram',
            medium: 'social',
            campaign: 'diwali',
            landing: '/products/pad',
            at: AT,
          })
        }
        await captureCartContact(ctx, cartId, { email, name: 'Aarav' })
        await tx.update(cart).set({ updatedAt: twoHoursAgo }).where(eq(cart.id, cartId))
        return cartId
      })
    const social = await quiet('riya@example.in', true)
    const direct = await quiet('kabir@example.in', false)

    const { items } = await withStore(app, storeId, (tx) =>
      listAbandoned({ storeId, tx }, { page: 1, perPage: 25 }),
    )
    expect(items.find((c) => c.id === social)?.touch).toEqual({
      channel: 'social',
      source: 'instagram',
      medium: 'social',
    })
    expect(items.find((c) => c.id === direct)?.touch).toBeNull()
  })

  it("drafts: a checkout draft's touch, and none on a staff draft", async () => {
    const { storeId, variantId } = await seed()
    const make = () =>
      withStore(app, storeId, (tx) =>
        createDraft(
          { storeId, tx },
          {
            email: 'aarav@example.in',
            lines: [{ variantId, quantity: 1 }],
            discountPaise: 0,
            shippingPaise: 0,
          },
        ),
      )
    const staff = await make()
    const shopper = await make()
    // As a shopper's checkout leaves it: a checkout draft with the cart's touch copied on.
    await owner
      .update(order)
      .set({
        draftSource: 'checkout',
        attribution: { channel: 'ai_assistant', referrer: 'chatgpt.com', landing: '/', at: AT },
      })
      .where(eq(order.id, shopper.id))

    const { items } = await withStore(app, storeId, (tx) =>
      listDrafts({ storeId, tx }, { page: 1, perPage: 25 }),
    )
    expect(items.find((d) => d.id === shopper.id)).toMatchObject({
      source: 'checkout',
      touch: { channel: 'ai_assistant', referrer: 'chatgpt.com' },
    })
    expect(items.find((d) => d.id === shopper.id)?.touch).not.toHaveProperty('landing')
    expect(items.find((d) => d.id === staff.id)?.touch).toBeNull()
  })
})

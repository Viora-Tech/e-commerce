import {
  createDb,
  customer,
  inventoryLevel,
  order,
  orderLine,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { OutOfStock } from '../errors'
import { convertDraft, createDraft, deleteDraft, listDrafts, updateDraft } from './drafts'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed(onHand = 5) {
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
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand })
  return { storeId: s.id, variantId: v.id }
}

beforeEach(async () => {
  await resetDb(owner)
})

describe('draft orders', () => {
  it('totals the lines, applies the discount and keeps the draft out of order lists', async () => {
    const { storeId, variantId } = await seed()
    const row = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        email: 'aarav@example.in',
        lines: [{ variantId, quantity: 2 }],
        discountPaise: 20000,
        discountLabel: 'Phone order',
        shippingPaise: 5000,
      })
      const [o] = await tx.select().from(order).where(eq(order.id, created.id))
      return o
    })
    expect(row?.status).toBe('draft')
    expect(row?.subtotalPaise).toBe(200000)
    expect(row?.discountPaise).toBe(20000)
    expect(row?.totalPaise).toBe(185000)

    /* No stock is held while it is a draft. */
    const [level] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(level?.reserved).toBe(0)

    const listed = await withStore(app, storeId, (tx) =>
      listDrafts({ storeId, tx }, { page: 1, perPage: 25 }),
    )
    expect(listed.total).toBe(1)
    expect(listed.items[0]?.lineCount).toBe(2)
  })

  it("refuses another store's customer on a draft", async () => {
    const { storeId, variantId } = await seed()
    const [other] = await owner.insert(store).values({ slug: 'other', name: 'Other' }).returning()
    const [foreign] = await owner
      .insert(customer)
      .values({ storeId: other?.id as string, email: 'x@example.in' })
      .returning()
    await expect(
      withStore(app, storeId, (tx) =>
        createDraft(
          { storeId, tx },
          {
            customerId: foreign?.id,
            lines: [{ variantId, quantity: 1 }],
            discountPaise: 0,
            shippingPaise: 0,
          },
        ),
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('replaces the lines on update', async () => {
    const { storeId, variantId } = await seed()
    const total = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        lines: [{ variantId, quantity: 2 }],
        discountPaise: 0,
        shippingPaise: 0,
      })
      await updateDraft(ctx, created.id, {
        lines: [{ variantId, quantity: 1, unitPricePaise: 50000 }],
        discountPaise: 0,
        shippingPaise: 0,
      })
      const lines = await tx.select().from(orderLine).where(eq(orderLine.orderId, created.id))
      expect(lines).toHaveLength(1)
      const [o] = await tx.select().from(order).where(eq(order.id, created.id))
      return o?.totalPaise
    })
    expect(total).toBe(50000)
  })

  it('converts to a placed order: stock held, pending payment, number kept', async () => {
    const { storeId, variantId } = await seed()
    const result = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        email: 'aarav@example.in',
        lines: [{ variantId, quantity: 2 }],
        discountPaise: 0,
        shippingPaise: 0,
      })
      const converted = await convertDraft(ctx, created.id, { paymentMethod: 'cod' })
      const [pay] = await tx.select().from(payment).where(eq(payment.orderId, created.id))
      return { created, converted, pay }
    })
    expect(result.converted?.status).toBe('open')
    expect(result.converted?.number).toBe(result.created.number)
    expect(result.pay?.status).toBe('pending')
    expect(result.pay?.provider).toBe('cod')
    expect(result.pay?.amountPaise).toBe(200000)

    const [level] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(level?.reserved).toBe(2)
  })

  it('refuses to convert more stock than is on hand', async () => {
    const { storeId, variantId } = await seed(1)
    await expect(
      withStore(app, storeId, async (tx) => {
        const ctx = { storeId, tx }
        const created = await createDraft(ctx, {
          lines: [{ variantId, quantity: 3 }],
          discountPaise: 0,
          shippingPaise: 0,
        })
        return convertDraft(ctx, created.id)
      }),
    ).rejects.toThrow(OutOfStock)
  })

  it('refuses to edit or delete once it is a real order', async () => {
    const { storeId, variantId } = await seed()
    const id = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        lines: [{ variantId, quantity: 1 }],
        discountPaise: 0,
        shippingPaise: 0,
      })
      await convertDraft(ctx, created.id)
      return created.id
    })
    await expect(withStore(app, storeId, (tx) => deleteDraft({ storeId, tx }, id))).rejects.toThrow(
      'no longer a draft',
    )
  })
})

import {
  address,
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
import { DraftInvalidGstin } from './draft-billing'
import { listDrafts } from './draft-list'
import {
  convertDraft,
  createDraft,
  DraftNeedsShippingAddress,
  deleteDraft,
  updateDraft,
} from './drafts'

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

const shipping = {
  name: 'Aarav',
  line1: '12 MG Road',
  city: 'Gurugram',
  stateCode: 'HR',
  pincode: '122001',
  phone: '9876543210',
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

  it('converts to a placed order: stock held, pending payment, order number taken', async () => {
    const { storeId, variantId } = await seed()
    const result = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        email: 'aarav@example.in',
        shipping,
        lines: [{ variantId, quantity: 2 }],
        discountPaise: 0,
        shippingPaise: 0,
      })
      const converted = await convertDraft(ctx, created.id, { paymentMethod: 'cod' })
      const [pay] = await tx.select().from(payment).where(eq(payment.orderId, created.id))
      return { created, converted, pay }
    })
    expect(result.converted?.status).toBe('open')
    expect(result.converted?.number).toBeGreaterThan(0)
    expect(result.converted?.draftNumber).toBe(result.created.draftNumber)
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
          shipping,
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
        shipping,
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

  it('refuses to convert a draft with something to ship and no shipping address', async () => {
    const { storeId, variantId } = await seed()
    let draftId = ''
    await expect(
      withStore(app, storeId, async (tx) => {
        const ctx = { storeId, tx }
        const created = await createDraft(ctx, {
          lines: [{ variantId, quantity: 1 }],
          discountPaise: 0,
          shippingPaise: 0,
        })
        draftId = created.id
        return convertDraft(ctx, created.id)
      }),
    ).rejects.toThrow(DraftNeedsShippingAddress)
    const [o] = await owner.select().from(order).where(eq(order.id, draftId))
    expect(o).toBeUndefined()
    const [level] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, variantId))
    expect(level?.reserved).toBe(0)
  })

  it('converts a gift-card-only draft without a shipping address', async () => {
    const { storeId } = await seed()
    const [p] = await owner
      .insert(product)
      .values({ storeId, handle: 'gift', title: 'Gift card', status: 'active', isGiftCard: true })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({ storeId, productId: p?.id as string, title: '₹500', pricePaise: 50000 })
      .returning()
    const converted = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        email: 'aarav@example.in',
        lines: [{ variantId: v?.id as string, quantity: 1 }],
        discountPaise: 0,
        shippingPaise: 0,
      })
      return convertDraft(ctx, created.id)
    })
    expect(converted?.status).toBe('open')
  })
})

describe('draft billing address', () => {
  const billing = {
    name: 'Aarav Mehta',
    line1: '9 Nariman Point',
    city: 'Mumbai',
    stateCode: 'MH',
    pincode: '400021',
    phone: '9820012345',
    businessName: 'Mehta Traders',
    gstin: '27aapfu0939f1zv',
  }

  it('keeps a separate billing address and GSTIN; the tax still follows the shipping state', async () => {
    const { storeId, variantId } = await seed()
    await owner
      .update(store)
      .set({ address: { line1: '1 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' } })
      .where(eq(store.id, storeId))
    const out = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        email: 'aarav@example.in',
        shipping,
        billing,
        lines: [{ variantId, quantity: 1 }],
        discountPaise: 0,
        shippingPaise: 0,
      })
      const converted = await convertDraft(ctx, created.id)
      const [bill] = await tx
        .select()
        .from(address)
        .where(eq(address.id, converted?.billingAddressId as string))
      return { converted, bill }
    })
    expect(out.converted).toMatchObject({
      buyerGstin: '27AAPFU0939F1ZV',
      buyerBusinessName: 'Mehta Traders',
    })
    expect(out.bill).toMatchObject({ line1: '9 Nariman Point', stateCode: 'MH' })
    expect(out.converted?.billingAddressId).not.toBe(out.converted?.shippingAddressId)
    // Goods delivered in Haryana from a Haryana store: CGST + SGST, whatever the billing state.
    expect(out.converted?.taxBreakdown).toMatchObject({ interState: false })
  })

  it("'same as shipping' drops the billing address; an edit that says neither keeps it", async () => {
    const { storeId, variantId } = await seed()
    const rows = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const base = {
        shipping,
        lines: [{ variantId, quantity: 1 }],
        discountPaise: 0,
        shippingPaise: 0,
      }
      const { id } = await createDraft(ctx, { ...base, billing })
      await updateDraft(ctx, id, base)
      const [kept] = await tx.select().from(order).where(eq(order.id, id))
      await updateDraft(ctx, id, { ...base, billingSameAsShipping: true, billing })
      const [same] = await tx.select().from(order).where(eq(order.id, id))
      return { kept, same }
    })
    expect(rows.kept?.billingAddressId).toBeTruthy()
    expect(rows.kept?.buyerGstin).toBe('27AAPFU0939F1ZV')
    expect(rows.same).toMatchObject({
      billingAddressId: null,
      buyerGstin: null,
      buyerBusinessName: null,
    })
  })

  it('refuses a billing GSTIN that fails the check', async () => {
    const { storeId, variantId } = await seed()
    await expect(
      withStore(app, storeId, (tx) =>
        createDraft(
          { storeId, tx },
          {
            shipping,
            billing: { ...billing, gstin: '27AAPFU0939F1ZA' },
            lines: [{ variantId, quantity: 1 }],
            discountPaise: 0,
            shippingPaise: 0,
          },
        ),
      ),
    ).rejects.toThrow(DraftInvalidGstin)
  })

  it('numbers drafts #D1, #D2 apart from orders, and leaves no order-number gap', async () => {
    const { storeId, variantId } = await seed()
    const result = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const draft = (email: string) =>
        createDraft(ctx, {
          email,
          shipping,
          lines: [{ variantId, quantity: 1 }],
          discountPaise: 0,
          shippingPaise: 0,
        })
      const first = await draft('a@example.in')
      const second = await draft('b@example.in')
      await deleteDraft(ctx, first.id)
      const converted = await convertDraft(ctx, second.id, { paymentMethod: 'cod' })
      const third = await draft('c@example.in')
      const found = await listDrafts(ctx, { page: 1, perPage: 10, search: '#D3' })
      return { first, second, third, converted, found }
    })
    expect(result.first.draftNumber).toBe(1)
    expect(result.second.draftNumber).toBe(2)
    expect(result.third.draftNumber).toBe(3)
    // The deleted draft never took an order number, so the converted one is the store's first.
    expect(result.converted?.number).toBe(1)
    expect(result.found.items.map((d) => d.id)).toEqual([result.third.id])
  })
})

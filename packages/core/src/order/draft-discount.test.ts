/** SOURCE OF TRUTH: tests for discount codes on draft orders and "Duplicate order" — WHAT: code check, save, free shipping, a use counted at conversion, limits; duplicate prefill and skipped lines / WHY: issues 795 and 674 */
import {
  address,
  createDb,
  discount,
  discountUsage,
  inventoryLevel,
  order,
  orderLine,
  orderNote,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { DiscountCodeRefused, DiscountUnavailable } from '../errors'
import { checkDraftDiscountCode } from './draft-discount'
import { convertDraft, createDraft, updateDraft } from './drafts'
import { duplicateOrderAsDraft } from './duplicate'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const shipping = {
  name: 'Aarav',
  line1: '12 MG Road',
  city: 'Gurugram',
  stateCode: 'HR',
  pincode: '122001',
  phone: '9876543210',
}

async function seed(rule: Partial<typeof discount.$inferInsert> = {}) {
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
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 20 })
  const [d] = await owner
    .insert(discount)
    .values({
      storeId: s.id,
      title: '10% off',
      code: 'SAVE10',
      method: 'percent',
      value: 1000,
      ...rule,
    })
    .returning()
  if (!d) throw new Error('seed')
  return { storeId: s.id, productId: p.id, variantId: v.id, discountId: d.id }
}

const draftInput = (variantId: string, quantity = 2, discountCode: string | null = 'save10') => ({
  email: 'Aarav@Example.in',
  shipping,
  lines: [{ variantId, quantity }],
  discountPaise: 0,
  discountCode,
  shippingPaise: 5000,
})

describe('discount codes on draft orders (#795)', () => {
  it('checks a code with checkout rules, without saving anything', async () => {
    const { storeId, variantId, discountId } = await seed({ minSubtotalPaise: 150000 })
    const [ok, low, unknown] = await withStore(app, storeId, (tx) =>
      Promise.all([
        checkDraftDiscountCode(
          { storeId, tx },
          { code: 'save10', lines: [{ variantId, quantity: 2 }] },
        ),
        checkDraftDiscountCode(
          { storeId, tx },
          { code: 'SAVE10', lines: [{ variantId, quantity: 1 }] },
        ),
        checkDraftDiscountCode(
          { storeId, tx },
          { code: 'NOPE', lines: [{ variantId, quantity: 2 }] },
        ),
      ]),
    )
    expect(ok).toMatchObject({ ok: true, discountId, code: 'SAVE10', amountPaise: 20000 })
    expect(low).toMatchObject({ ok: false, reason: 'min_subtotal' })
    expect(unknown).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('saves the code on the draft, replacing the manual discount', async () => {
    const { storeId, variantId, discountId } = await seed()
    const row = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        ...draftInput(variantId),
        discountPaise: 99999,
        discountLabel: 'Manual',
      })
      const [o] = await tx.select().from(order).where(eq(order.id, created.id))
      return o
    })
    expect(row).toMatchObject({
      discountId,
      discountCode: 'SAVE10',
      discountLabel: '10% off',
      discountPaise: 20000,
      totalPaise: 200000 - 20000 + 5000,
    })
  })

  it('refuses a save once the code stops applying, and drops it when removed', async () => {
    const { storeId, variantId } = await seed({ minSubtotalPaise: 150000 })
    await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, draftInput(variantId))
      await expect(updateDraft(ctx, created.id, draftInput(variantId, 1))).rejects.toMatchObject({
        code: 'DRAFT_DISCOUNT_REJECTED',
      })
      await updateDraft(ctx, created.id, draftInput(variantId, 1, null))
      const [o] = await tx.select().from(order).where(eq(order.id, created.id))
      expect(o).toMatchObject({ discountId: null, discountCode: null, discountPaise: 0 })
    })
  })

  it('a free-shipping code waives the draft shipping charge', async () => {
    const { storeId, variantId } = await seed({
      type: 'shipping',
      method: 'free_shipping',
      value: 0,
      code: 'SHIPFREE',
    })
    const row = await withStore(app, storeId, async (tx) => {
      const created = await createDraft(
        { storeId, tx },
        { ...draftInput(variantId), discountCode: 'shipfree' },
      )
      const [o] = await tx.select().from(order).where(eq(order.id, created.id))
      return o
    })
    expect(row).toMatchObject({ discountPaise: 0, shippingPaise: 0, totalPaise: 200000 })
  })

  it('converting counts a use and records the order against the code', async () => {
    const { storeId, variantId, discountId } = await seed({ usagePerCustomer: 1 })
    await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, draftInput(variantId))
      await convertDraft(ctx, created.id)
      // The same customer cannot use it again: the per-customer cap counts the draft's order.
      const again = await checkDraftDiscountCode(ctx, {
        code: 'SAVE10',
        lines: [{ variantId, quantity: 2 }],
        email: 'aarav@example.in',
      })
      expect(again).toMatchObject({ ok: false, reason: 'limit_reached' })
    })
    const [d] = await owner.select().from(discount).where(eq(discount.id, discountId))
    expect(d?.usedCount).toBe(1)
    const uses = await owner
      .select()
      .from(discountUsage)
      .where(eq(discountUsage.discountId, discountId))
    expect(uses).toHaveLength(1)
    expect(uses[0]).toMatchObject({ amountPaise: 20000, email: 'aarav@example.in' })
  })

  it('a code out of uses blocks the conversion', async () => {
    const { storeId, variantId, discountId } = await seed({ usageLimit: 1 })
    const draftId = await withStore(app, storeId, async (tx) => {
      const created = await createDraft({ storeId, tx }, draftInput(variantId))
      return created.id
    })
    await owner.update(discount).set({ usedCount: 1 }).where(eq(discount.id, discountId))
    await expect(
      withStore(app, storeId, (tx) => convertDraft({ storeId, tx }, draftId)),
    ).rejects.toSatisfy((e) => e instanceof DiscountUnavailable || e instanceof DiscountCodeRefused)
    const [o] = await owner.select().from(order).where(eq(order.id, draftId))
    expect(o?.status).toBe('draft')
  })
})

describe('duplicate order (#674)', () => {
  it('starts a draft with the same customer, address, lines at today’s price and notes', async () => {
    const { storeId, variantId, productId } = await seed()
    const [p2] = await owner
      .insert(product)
      .values({ storeId, handle: 'old', title: 'Old mat', status: 'active' })
      .returning()
    const [v2] = await owner
      .insert(variant)
      .values({ storeId, productId: p2?.id as string, title: 'Default', pricePaise: 5000 })
      .returning()
    await owner.insert(inventoryLevel).values({ storeId, variantId: v2?.id as string, onHand: 5 })
    const source = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const created = await createDraft(ctx, {
        ...draftInput(variantId, 3, null),
        lines: [
          { variantId, quantity: 3, unitPricePaise: 1000 },
          { variantId: v2?.id as string, quantity: 1 },
        ],
        note: 'Gift wrap',
      })
      await convertDraft(ctx, created.id)
      return created
    })
    await owner
      .update(product)
      .set({ status: 'archived' })
      .where(eq(product.id, p2?.id as string))
    await owner.update(variant).set({ pricePaise: 120000 }).where(eq(variant.productId, productId))

    const copy = await withStore(app, storeId, (tx) =>
      duplicateOrderAsDraft({ storeId, tx }, source.id),
    )
    expect(copy?.skipped).toEqual(['Old mat'])
    const [o] = await owner
      .select()
      .from(order)
      .where(eq(order.id, copy?.id as string))
    expect(o).toMatchObject({ status: 'draft', email: 'Aarav@Example.in', shippingPaise: 5000 })
    expect(o?.id).not.toBe(source.id)
    const lines = await owner
      .select()
      .from(orderLine)
      .where(eq(orderLine.orderId, copy?.id as string))
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ variantId, quantity: 3, unitPricePaise: 120000 })
    const [a] = await owner
      .select()
      .from(address)
      .where(eq(address.id, o?.shippingAddressId as string))
    expect(a).toMatchObject({ line1: '12 MG Road', pincode: '122001' })
    const notes = await owner
      .select()
      .from(orderNote)
      .where(eq(orderNote.orderId, copy?.id as string))
    expect(notes[0]?.body).toContain('Gift wrap')
    expect(notes[0]?.body).toContain('Old mat')
  })

  it('is null for an order outside the store', async () => {
    const { storeId } = await seed()
    const result = await withStore(app, storeId, (tx) =>
      duplicateOrderAsDraft({ storeId, tx }, '00000000-0000-4000-8000-000000000009'),
    )
    expect(result).toBeNull()
  })
})

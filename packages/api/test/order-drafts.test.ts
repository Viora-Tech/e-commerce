import { createMerchantAuth } from '@commerce/auth'
import { createDb, inventoryLevel, order, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

const ctx = (headers: Headers) =>
  ({ db: app, auth, headers, notifications: { add: async () => undefined } }) as ApiContext

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  return { ctx: ctx(headers), storeId: s?.id as string }
}

async function seedVariant(storeId: string, onHand: number) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Black', pricePaise: 100000 })
    .returning()
  const variantId = v?.id as string
  await owner.insert(inventoryLevel).values({ storeId, variantId, onHand })
  return variantId
}

const draftOf = (variantId: string) => ({
  customerId: null,
  email: 'aarav@example.in',
  phone: null,
  customerName: 'Aarav',
  shipping: {
    name: 'Aarav',
    line1: '12 MG Road',
    city: 'Gurugram',
    stateCode: 'HR',
    pincode: '122001',
    phone: '9876543210',
  },
  lines: [{ variantId, quantity: 1, unitPricePaise: 100000 }],
  discountPaise: 0,
  discountLabel: null,
  shippingPaise: 0,
  paymentMethod: 'manual',
  note: null,
})

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('draft orders router', () => {
  it('converts a saved draft into an open order', async () => {
    const m = await merchant('a@example.com', 'drafts-convert')
    const variantId = await seedVariant(m.storeId, 5)
    const { id } = await call(
      appRouter.orders.saveDraft,
      { draft: draftOf(variantId) },
      { context: m.ctx },
    )
    const row = await call(
      appRouter.orders.convertDraft,
      { id, paymentMethod: 'manual' },
      { context: m.ctx },
    )
    expect(row.status).toBe('open')
  })

  it('refuses to convert a draft with goods to ship and no shipping address', async () => {
    const m = await merchant('a@example.com', 'drafts-no-address')
    const variantId = await seedVariant(m.storeId, 5)
    const { id } = await call(
      appRouter.orders.saveDraft,
      { draft: { ...draftOf(variantId), shipping: null } },
      { context: m.ctx },
    )
    await expect(
      call(appRouter.orders.convertDraft, { id }, { context: m.ctx }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Add a shipping address before converting',
    })
    const [o] = await owner.select().from(order).where(eq(order.id, id))
    expect(o?.status).toBe('draft')
  })

  it('names the product when there is not enough stock to convert, and keeps the draft', async () => {
    const m = await merchant('a@example.com', 'drafts-oos')
    const variantId = await seedVariant(m.storeId, 0)
    const { id } = await call(
      appRouter.orders.saveDraft,
      { draft: draftOf(variantId) },
      { context: m.ctx },
    )
    // Before the fix this escaped as a bare CommerceError: a 500 "Internal server error".
    await expect(
      call(appRouter.orders.convertDraft, { id }, { context: m.ctx }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Not enough stock of Glasspad / Black to place this order',
    })
    const [o] = await owner.select().from(order).where(eq(order.id, id))
    expect(o?.status).toBe('draft')
  })

  it('refuses to delete a draft that was already converted', async () => {
    const m = await merchant('a@example.com', 'drafts-del-placed')
    const variantId = await seedVariant(m.storeId, 5)
    const { id } = await call(
      appRouter.orders.saveDraft,
      { draft: draftOf(variantId) },
      { context: m.ctx },
    )
    await call(appRouter.orders.convertDraft, { id }, { context: m.ctx })
    await expect(
      call(appRouter.orders.deleteDraft, { id }, { context: m.ctx }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    const [o] = await owner.select().from(order).where(eq(order.id, id))
    expect(o?.status).toBe('open')
  })

  it('bulk deletes drafts only, skipping one that became an order', async () => {
    const m = await merchant('a@example.com', 'drafts-bulk')
    const variantId = await seedVariant(m.storeId, 5)
    const save = () =>
      call(appRouter.orders.saveDraft, { draft: draftOf(variantId) }, { context: m.ctx })
    const a = await save()
    const b = await save()
    const placed = await save()
    await call(appRouter.orders.convertDraft, { id: placed.id }, { context: m.ctx })

    const r = await call(
      appRouter.orders.deleteDrafts,
      { ids: [a.id, b.id, placed.id] },
      { context: m.ctx },
    )
    expect(r.deleted).toBe(2)
    const left = await owner
      .select({ id: order.id, status: order.status })
      .from(order)
      .where(eq(order.storeId, m.storeId))
    expect(left).toEqual([{ id: placed.id, status: 'open' }])
  })

  it("cannot bulk delete another store's drafts", async () => {
    const mine = await merchant('a@example.com', 'drafts-mine')
    const other = await merchant('b@example.com', 'drafts-other')
    const variantId = await seedVariant(mine.storeId, 5)
    const { id } = await call(
      appRouter.orders.saveDraft,
      { draft: draftOf(variantId) },
      { context: mine.ctx },
    )
    const r = await call(appRouter.orders.deleteDrafts, { ids: [id] }, { context: other.ctx })
    expect(r.deleted).toBe(0)
    const [o] = await owner.select().from(order).where(eq(order.id, id))
    expect(o?.status).toBe('draft')
  })
})

import { createMerchantAuth } from '@commerce/auth'
import {
  cart,
  cartLine,
  collection,
  collectionProduct,
  createDb,
  newId,
  order,
  orderLine,
  product,
  returnRequest,
  shipment,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  return { ctx, storeId: s?.id as string }
}

type Merchant = Awaited<ReturnType<typeof merchant>>

async function seedVariant(storeId: string, title: string) {
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId, title, handle: `p-${productId}`, status: 'active' })
  const variantId = newId()
  await owner
    .insert(variant)
    .values({ id: variantId, storeId, productId, title: 'Default', pricePaise: 1000, sku: title })
  return { productId, variantId }
}

type OrderSeed = Partial<typeof order.$inferInsert> & { number: number; variantId: string }

/** An order (or draft) with one line of the variant. */
async function seedOrder(storeId: string, { variantId, ...o }: OrderSeed) {
  const id = newId()
  await owner.insert(order).values({
    id,
    storeId,
    status: 'open',
    subtotalPaise: o.totalPaise ?? 1000,
    totalPaise: 1000,
    ...o,
  })
  await owner.insert(orderLine).values({
    storeId,
    orderId: id,
    variantId,
    title: 'Line',
    quantity: 1,
    unitPricePaise: 1000,
  })
  return id
}

const numbers = async (m: Merchant, input: object) =>
  (await call(appRouter.orders.list, { page: 1, perPage: 50, ...input }, { context: m.ctx })).items
    .map((o) => o.number)
    .sort((a, b) => a - b)

const DAY = 86_400_000
const OLD = new Date('2026-09-01T10:00:00Z')

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('orders list filters (F3)', () => {
  it('filters by tags, channel, value, discount code, return status and collection (#886)', async () => {
    const m = await merchant('f3-orders@example.com', 'f3-orders')
    const pad = await seedVariant(m.storeId, 'Pad')
    const mouse = await seedVariant(m.storeId, 'Mouse')
    const collectionId = newId()
    await owner
      .insert(collection)
      .values({ id: collectionId, storeId: m.storeId, title: 'Pads', handle: 'pads' })
    await owner
      .insert(collectionProduct)
      .values({ storeId: m.storeId, collectionId, productId: pad.productId })

    const o1 = await seedOrder(m.storeId, {
      number: 1,
      variantId: pad.variantId,
      tags: ['vip'],
      attribution: { channel: 'social', at: '2026-10-01T00:00:00Z' },
      totalPaise: 50_000,
      discountCode: 'diwali10',
      paymentStatus: 'paid',
    })
    await seedOrder(m.storeId, {
      number: 2,
      variantId: mouse.variantId,
      tags: ['wholesale'],
      attribution: { channel: 'email', at: '2026-10-01T00:00:00Z' },
      totalPaise: 5_000,
    })
    const o3 = await seedOrder(m.storeId, {
      number: 3,
      variantId: mouse.variantId,
      totalPaise: 20_000,
      paymentStatus: 'paid',
    })
    await seedOrder(m.storeId, { number: 4, status: 'draft', variantId: pad.variantId })
    await owner.insert(returnRequest).values([
      { storeId: m.storeId, orderId: o1, number: 1, status: 'requested' },
      { storeId: m.storeId, orderId: o3, number: 2, status: 'resolved' },
    ])

    expect(await numbers(m, { tags: ['vip', 'nothing'] })).toEqual([1])
    expect(await numbers(m, { channels: ['email'] })).toEqual([2])
    expect(await numbers(m, { channels: ['untracked', 'social'] })).toEqual([1, 3])
    expect(await numbers(m, { totalMinPaise: 10_000, totalMaxPaise: 30_000 })).toEqual([3])
    expect(await numbers(m, { discountCodes: ['DIWALI10'] })).toEqual([1])
    expect(await numbers(m, { returnStatus: ['none'] })).toEqual([2])
    expect(await numbers(m, { returnStatus: ['requested', 'done'] })).toEqual([1, 3])
    // The draft has a pad too, but no list shows a draft.
    expect(await numbers(m, { collectionIds: [collectionId] })).toEqual([1])
    // Combined with a tab, the payment filter and the Product filter.
    expect(await numbers(m, { view: 'all', paymentStatus: ['paid'], product: 'mouse' })).toEqual([
      3,
    ])
    expect(await numbers(m, { collectionIds: [collectionId], returnStatus: ['done'] })).toEqual([])
    const ids = await call(
      appRouter.orders.ids,
      { collectionIds: [collectionId] },
      { context: m.ctx },
    )
    expect(ids).toEqual([o1])

    const facets = await call(appRouter.orders.facets, undefined, { context: m.ctx })
    expect(facets.tags).toEqual(['vip', 'wholesale'])
    expect(facets.discountCodes).toEqual(['DIWALI10'])
    expect(facets.collections).toEqual([{ id: collectionId, title: 'Pads' }])
  })
})

describe('drafts, abandoned, returns and shipments filters (F3)', () => {
  it('filters drafts by created window and total', async () => {
    const m = await merchant('f3-drafts@example.com', 'f3-drafts')
    const pad = await seedVariant(m.storeId, 'Pad')
    await seedOrder(m.storeId, {
      number: 10,
      status: 'draft',
      variantId: pad.variantId,
      totalPaise: 90_000,
    })
    await seedOrder(m.storeId, {
      number: 11,
      status: 'draft',
      variantId: pad.variantId,
      totalPaise: 1_000,
      placedAt: OLD,
    })
    const drafts = async (input: object) =>
      (
        await call(
          appRouter.orders.listDrafts,
          { page: 1, perPage: 50, ...input },
          { context: m.ctx },
        )
      ).items.map((d) => d.number)
    expect(await drafts({ totalMinPaise: 50_000 })).toEqual([10])
    expect(await drafts({ createdTo: '2026-09-02T00:00:00.000Z' })).toEqual([11])
  })

  it('filters abandoned checkouts by an older window, value and contact', async () => {
    const m = await merchant('f3-abandoned@example.com', 'f3-abandoned')
    const pad = await seedVariant(m.storeId, 'Pad')
    const [recent] = await owner
      .insert(cart)
      .values({
        storeId: m.storeId,
        email: 'a@example.com',
        updatedAt: new Date(Date.now() - 2 * 3_600_000),
      })
      .returning()
    const [stale] = await owner
      .insert(cart)
      .values({
        storeId: m.storeId,
        phone: '+919999999999',
        updatedAt: new Date(Date.now() - 60 * DAY),
      })
      .returning()
    await owner.insert(cartLine).values([
      {
        storeId: m.storeId,
        cartId: recent?.id as string,
        variantId: pad.variantId,
        quantity: 1,
        unitPricePaise: 500,
      },
      {
        storeId: m.storeId,
        cartId: stale?.id as string,
        variantId: pad.variantId,
        quantity: 4,
        unitPricePaise: 50_000,
      },
    ])
    const abandoned = async (input: object) =>
      (
        await call(
          appRouter.orders.listAbandoned,
          { page: 1, perPage: 50, ...input },
          { context: m.ctx },
        )
      ).items.map((c) => c.id)
    expect(await abandoned({})).toEqual([recent?.id])
    const from = new Date(Date.now() - 90 * DAY).toISOString()
    expect(await abandoned({ activeFrom: from, valueMinPaise: 100_000 })).toEqual([stale?.id])
    expect(await abandoned({ activeFrom: from, contact: 'email' })).toEqual([recent?.id])
    expect(await abandoned({ activeFrom: from, contact: 'both' })).toEqual([])
  })

  it('filters returns by reason, outcome and asked on', async () => {
    const m = await merchant('f3-returns@example.com', 'f3-returns')
    const pad = await seedVariant(m.storeId, 'Pad')
    const placed = await seedOrder(m.storeId, { number: 20, variantId: pad.variantId })
    await owner.insert(returnRequest).values([
      { storeId: m.storeId, orderId: placed, number: 1, reason: 'damaged', resolution: 'refund' },
      { storeId: m.storeId, orderId: placed, number: 2, reason: 'size', requestedAt: OLD },
    ])
    const returns = async (input: object) =>
      (
        await call(appRouter.returns.list, { page: 1, perPage: 50, ...input }, { context: m.ctx })
      ).items
        .map((r) => r.number)
        .sort((a, b) => a - b)
    expect(await returns({ reasons: ['size', 'quality'] })).toEqual([2])
    expect(await returns({ resolutions: ['refund'] })).toEqual([1])
    expect(await returns({ requestedFrom: '2026-10-01T00:00:00.000Z' })).toEqual([1])
  })

  it('filters shipments by courier, delivery problem, booked date and payment method', async () => {
    const m = await merchant('f3-shipments@example.com', 'f3-shipments')
    const pad = await seedVariant(m.storeId, 'Pad')
    const prepaid = await seedOrder(m.storeId, {
      number: 30,
      variantId: pad.variantId,
      paymentMethod: 'razorpay',
    })
    const cod = await seedOrder(m.storeId, {
      number: 31,
      variantId: pad.variantId,
      paymentMethod: 'cod',
    })
    await owner.insert(shipment).values([
      {
        storeId: m.storeId,
        orderId: prepaid,
        provider: 'delhivery',
        waybill: 'D1',
        ndrStatus: 'pending',
      },
      { storeId: m.storeId, orderId: cod, provider: 'shiprocket', waybill: 'S1', createdAt: OLD },
    ])
    const shipments = async (input: object) =>
      (
        await call(appRouter.shipments.list, { page: 1, perPage: 50, ...input }, { context: m.ctx })
      ).items
        .map((s) => s.waybill)
        .sort()
    expect(await shipments({ provider: 'delhivery' })).toEqual(['D1'])
    expect(await shipments({ ndrStatus: ['pending'] })).toEqual(['D1'])
    expect(await shipments({ paymentMethod: 'cod' })).toEqual(['S1'])
    expect(await shipments({ paymentMethod: 'prepaid' })).toEqual(['D1'])
    expect(await shipments({ bookedTo: '2026-09-02T00:00:00.000Z' })).toEqual(['S1'])
    await expect(
      call(appRouter.shipments.list, { ndrStatus: ['bogus'] } as never, { context: m.ctx }),
    ).rejects.toThrow()
  })
})

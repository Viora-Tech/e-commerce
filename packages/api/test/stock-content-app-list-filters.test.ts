import { createMerchantAuth } from '@commerce/auth'
import {
  article,
  blog,
  createDb,
  inboundShipment,
  location,
  newId,
  order,
  product,
  purchaseOrder,
  store,
  supplier,
  transfer,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import {
  affiliate,
  affiliateCommission,
  affiliateProgram,
} from '@commerce/plugin-affiliates/schema'
import { review } from '@commerce/plugin-reviews/schema'
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

/** An owner whose store has the Reviews and Affiliates apps. */
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
    .values({
      slug,
      name: slug,
      organizationId: org?.id as string,
      apps: {
        installed: ['reviews', 'affiliates'],
        settings: { affiliates: { holdDays: 5, commission: { type: 'percent', bp: 1500 } } },
      },
    })
    .returning()
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  await call(appRouter.staff.me, {}, { context: ctx })
  return { ctx, storeId: s?.id as string }
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000)
const iso = (d: Date) => d.toISOString()

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('stock list filters', () => {
  it('filters purchase orders, transfers, inbound shipments and suppliers', async () => {
    const m = await merchant('stock@example.com', 'stock-f5')
    const storeId = m.storeId
    const [north, south] = await owner
      .insert(location)
      .values([
        { storeId, name: 'North' },
        { storeId, name: 'South' },
      ])
      .returning()
    const [pads, cables] = await owner
      .insert(supplier)
      .values([
        { storeId, name: 'Shenzhen Pads', country: 'CN', currency: 'USD' },
        { storeId, name: 'Pune Cables', country: 'IN', gstin: '27AAPFU0939F1ZV' },
      ])
      .returning()
    await owner
      .insert(supplier)
      .values({ storeId, name: 'Idle Co', country: 'US', currency: 'USD' })
    const n = north?.id as string
    const s = south?.id as string
    await owner.insert(purchaseOrder).values([
      {
        storeId,
        number: 1,
        supplierId: pads?.id,
        supplierName: 'Shenzhen Pads',
        locationId: n,
        status: 'ordered',
        expectedAt: new Date('2026-11-05T06:00:00Z'),
        createdAt: daysAgo(40),
      },
      {
        storeId,
        number: 2,
        supplierId: cables?.id,
        supplierName: 'Pune Cables',
        locationId: s,
        status: 'draft',
        createdAt: daysAgo(3),
      },
      {
        storeId,
        number: 3,
        supplierId: pads?.id,
        supplierName: 'Shenzhen Pads',
        locationId: s,
        status: 'received',
        expectedAt: new Date('2026-12-20T06:00:00Z'),
        createdAt: daysAgo(10),
      },
    ])
    const pos = async (input: Record<string, unknown>) =>
      (await call(appRouter.purchaseOrders.list, input, { context: m.ctx })).rows
        .map((r) => r.number)
        .sort()

    expect(await pos({ statuses: ['ordered', 'received'] })).toEqual([1, 3])
    expect(await pos({ supplierIds: [pads?.id] })).toEqual([1, 3])
    expect(await pos({ locationIds: [s] })).toEqual([2, 3])
    expect(
      await pos({
        expectedFrom: '2026-11-01T00:00:00.000Z',
        expectedTo: '2026-12-01T00:00:00.000Z',
      }),
    ).toEqual([1])
    expect(await pos({ createdFrom: iso(daysAgo(30)) })).toEqual([2, 3])
    // Combines with the tab and search.
    expect(await pos({ status: 'received', supplierIds: [pads?.id] })).toEqual([3])
    expect(await pos({ search: 'pune', locationIds: [s] })).toEqual([2])
    const paged = await call(
      appRouter.purchaseOrders.list,
      { locationIds: [s], perPage: 1, page: 2 },
      { context: m.ctx },
    )
    expect(paged.total).toBe(2)
    expect(paged.rows).toHaveLength(1)

    await owner.insert(transfer).values([
      {
        storeId,
        number: 1,
        fromLocationId: n,
        toLocationId: s,
        status: 'draft',
        createdAt: daysAgo(2),
      },
      {
        storeId,
        number: 2,
        fromLocationId: s,
        toLocationId: n,
        status: 'received',
        receivedAt: daysAgo(20),
        createdAt: daysAgo(25),
      },
    ])
    const transfers = async (input: Record<string, unknown>) =>
      (await call(appRouter.transfers.list, input, { context: m.ctx })).rows
        .map((r) => r.number)
        .sort()
    expect(await transfers({ statuses: ['received'] })).toEqual([2])
    expect(await transfers({ fromLocationIds: [n] })).toEqual([1])
    expect(await transfers({ toLocationIds: [n] })).toEqual([2])
    expect(await transfers({ createdFrom: iso(daysAgo(7)) })).toEqual([1])
    expect(
      await transfers({ receivedFrom: iso(daysAgo(30)), receivedTo: iso(daysAgo(10)) }),
    ).toEqual([2])
    expect(await transfers({ status: 'draft', toLocationIds: [n] })).toEqual([])

    await owner.insert(inboundShipment).values([
      {
        storeId,
        number: 1,
        status: 'at_port',
        billOfEntryNo: 'BE-1',
        expectedAt: '2026-11-05',
      },
      { storeId, number: 2, status: 'delivered', arrivedAt: daysAgo(5) },
    ])
    const inbound = async (input: Record<string, unknown>) =>
      (await call(appRouter.inboundShipments.list, input, { context: m.ctx })).rows
        .map((r) => r.number)
        .sort()
    expect(await inbound({ statuses: ['at_port', 'cleared'] })).toEqual([1])
    expect(await inbound({ hasBillOfEntry: false })).toEqual([2])
    expect(await inbound({ arrivedFrom: iso(daysAgo(7)) })).toEqual([2])
    // The 5th of November in India time starts at 18:30 UTC on the 4th.
    expect(
      await inbound({
        expectedFrom: '2026-11-04T18:30:00.000Z',
        expectedTo: '2026-11-05T18:30:00.000Z',
      }),
    ).toEqual([1])
    expect(await inbound({ expectedFrom: '2026-11-05T18:30:00.000Z' })).toEqual([])

    const suppliers = async (input: Record<string, unknown>) =>
      (await call(appRouter.suppliers.list, input, { context: m.ctx })).rows.map((r) => r.name)
    expect(await suppliers({ countries: ['CN', 'US'] })).toEqual(['Idle Co', 'Shenzhen Pads'])
    expect(await suppliers({ currencies: ['INR'] })).toEqual(['Pune Cables'])
    expect(await suppliers({ hasGstin: true })).toEqual(['Pune Cables'])
    expect(await suppliers({ hasOrders: false })).toEqual(['Idle Co'])
    expect(await suppliers({ hasOrders: true, search: 'shen' })).toEqual(['Shenzhen Pads'])
    expect(await call(appRouter.suppliers.facets, undefined, { context: m.ctx })).toEqual({
      countries: ['CN', 'IN', 'US'],
      currencies: ['INR', 'USD'],
    })
  })
})

describe('content and app list filters', () => {
  it('filters reviews by ratings, products, source, flags and date', async () => {
    const m = await merchant('rev@example.com', 'rev-f5')
    const storeId = m.storeId
    const [veil, pad] = await owner
      .insert(product)
      .values([
        { id: newId(), storeId, title: 'Veil', handle: 'veil', status: 'active' },
        { id: newId(), storeId, title: 'Pad', handle: 'pad', status: 'active' },
      ])
      .returning()
    await owner.insert(review).values([
      {
        storeId,
        productId: veil?.id,
        rating: 5,
        title: 'A',
        status: 'published',
        verifiedBuyer: true,
        createdAt: daysAgo(2),
      },
      {
        storeId,
        productId: pad?.id,
        rating: 3,
        title: 'B',
        source: 'judgeme',
        reply: 'Thanks',
        createdAt: daysAgo(40),
      },
      {
        storeId,
        productId: veil?.id,
        rating: 1,
        title: 'C',
        featured: true,
        createdAt: daysAgo(10),
      },
    ])
    const titles = async (input: Record<string, unknown>) =>
      (await call(appRouter.reviews.list, { page: 1, ...input }, { context: m.ctx })).rows
        .map((r) => r.title)
        .sort()
    expect(await titles({ ratings: [5, 1] })).toEqual(['A', 'C'])
    expect(await titles({ productIds: [pad?.id] })).toEqual(['B'])
    expect(await titles({ sources: ['judgeme'] })).toEqual(['B'])
    expect(await titles({ verifiedBuyer: true })).toEqual(['A'])
    expect(await titles({ featured: true })).toEqual(['C'])
    expect(await titles({ replied: false })).toEqual(['A', 'C'])
    expect(await titles({ createdFrom: iso(daysAgo(30)) })).toEqual(['A', 'C'])
    expect(await titles({ status: 'published', ratings: [5, 1] })).toEqual(['A'])
    expect(await titles({ q: 'veil', ratings: [1, 3] })).toEqual(['C'])
  })

  it('filters blog posts by blogs, tags, authors, published date and image', async () => {
    const m = await merchant('blog@example.com', 'blog-f5')
    const storeId = m.storeId
    const [news, guides] = await owner
      .insert(blog)
      .values([
        { storeId, title: 'News', handle: 'news' },
        { storeId, title: 'Guides', handle: 'guides' },
      ])
      .returning()
    await owner.insert(article).values([
      {
        storeId,
        blogId: news?.id as string,
        title: 'Launch',
        handle: 'launch',
        author: 'Asha',
        tags: ['drops'],
        status: 'published',
        publishedAt: daysAgo(3),
      },
      {
        storeId,
        blogId: guides?.id as string,
        title: 'Care',
        handle: 'care',
        author: 'Ravi',
        tags: ['how-to', 'drops'],
        status: 'published',
        publishedAt: daysAgo(60),
      },
      {
        storeId,
        blogId: guides?.id as string,
        title: 'Draft',
        handle: 'draft',
        tags: ['how-to'],
        status: 'draft',
      },
    ])
    const titles = async (input: Record<string, unknown>) =>
      (await call(appRouter.blog.list, input, { context: m.ctx })).rows.map((r) => r.title).sort()
    expect(await titles({ blogIds: [guides?.id] })).toEqual(['Care', 'Draft'])
    expect(await titles({ tags: ['drops'] })).toEqual(['Care', 'Launch'])
    expect(await titles({ authors: ['Asha', 'Ravi'] })).toEqual(['Care', 'Launch'])
    expect(await titles({ publishedFrom: iso(daysAgo(7)) })).toEqual(['Launch'])
    expect(await titles({ hasImage: false, tags: ['how-to'] })).toEqual(['Care', 'Draft'])
    expect(await titles({ hasImage: true })).toEqual([])
    expect(await titles({ status: 'draft', blogIds: [guides?.id] })).toEqual(['Draft'])
    expect(await titles({ query: 'car', tags: ['drops'] })).toEqual(['Care'])
    expect(await call(appRouter.blog.authors, undefined, { context: m.ctx })).toEqual([
      'Asha',
      'Ravi',
    ])
  })

  it('filters affiliates and commissions on the server', async () => {
    const m = await merchant('aff@example.com', 'aff-f5')
    const storeId = m.storeId
    const [vip] = await owner
      .insert(affiliateProgram)
      .values({ storeId, name: 'VIP', slug: 'vip' })
      .returning()
    const [asha, ravi, meera] = await owner
      .insert(affiliate)
      .values([
        { storeId, code: 'ASHA', name: 'Asha', status: 'approved', createdAt: daysAgo(40) },
        {
          storeId,
          code: 'RAVI',
          name: 'Ravi',
          status: 'pending',
          programId: vip?.id,
          createdAt: daysAgo(2),
        },
        { storeId, code: 'MEERA', name: 'Meera', status: 'suspended', createdAt: daysAgo(5) },
      ])
      .returning()
    const base = {
      storeId,
      subtotalPaise: 1,
      totalPaise: 1000,
      status: 'open' as const,
      paymentStatus: 'paid' as const,
    }
    const [o1, o2, o3] = await owner
      .insert(order)
      .values([
        { ...base, number: 101, placedAt: daysAgo(3) },
        { ...base, number: 102, placedAt: daysAgo(20) },
        { ...base, number: 103, placedAt: daysAgo(1) },
      ])
      .returning()
    const commission = {
      storeId,
      basePaise: 100_000,
      earnedPaise: 0,
      tdsPaise: 0,
    }
    await owner.insert(affiliateCommission).values([
      {
        ...commission,
        affiliateId: asha?.id as string,
        orderId: o1?.id as string,
        source: 'link',
        status: 'approved',
        earnedPaise: 15_000,
        commissionPaise: 15_000,
        placedAt: daysAgo(3),
      },
      {
        ...commission,
        affiliateId: asha?.id as string,
        orderId: o2?.id as string,
        source: 'coupon',
        status: 'pending',
        earnedPaise: 5_000,
        commissionPaise: 5_000,
        flag: 'self_referral',
        placedAt: daysAgo(20),
      },
      {
        ...commission,
        affiliateId: ravi?.id as string,
        orderId: o3?.id as string,
        source: 'coupon',
        status: 'paid',
        earnedPaise: 2_000,
        commissionPaise: 2_000,
        placedAt: daysAgo(1),
      },
    ])

    const names = async (input?: Record<string, unknown>) =>
      (await call(appRouter.affiliates.list, input, { context: m.ctx })).map((a) => a.name).sort()
    expect(await names()).toEqual(['Asha', 'Meera', 'Ravi'])
    expect(await names({ statuses: ['pending', 'suspended'] })).toEqual(['Meera', 'Ravi'])
    expect(await names({ programIds: [vip?.id] })).toEqual(['Ravi'])
    expect(await names({ joinedFrom: iso(daysAgo(7)) })).toEqual(['Meera', 'Ravi'])
    expect(await names({ minEarnedPaise: 10_000 })).toEqual(['Asha'])
    expect(await names({ maxEarnedPaise: 0 })).toEqual(['Meera'])
    expect(await names({ search: 'rav' })).toEqual(['Ravi'])
    expect(meera).toBeDefined()

    const orders = async (input: Record<string, unknown>) =>
      (await call(appRouter.affiliates.commissions.list, input, { context: m.ctx }))
        .map((c) => c.orderNumber)
        .sort()
    expect(await orders({})).toEqual([101, 102, 103])
    expect(await orders({ statuses: ['approved', 'paid'] })).toEqual([101, 103])
    expect(await orders({ sources: ['coupon'] })).toEqual([102, 103])
    expect(await orders({ affiliateIds: [ravi?.id] })).toEqual([103])
    expect(await orders({ placedFrom: iso(daysAgo(7)) })).toEqual([101, 103])
    expect(await orders({ minCommissionPaise: 3_000, maxCommissionPaise: 10_000 })).toEqual([102])
    expect(await orders({ flagged: true })).toEqual([102])
    expect(await orders({ search: '#103' })).toEqual([103])
    expect(await orders({ search: 'asha', sources: ['link'] })).toEqual([101])
  })
})

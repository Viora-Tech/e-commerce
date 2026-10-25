import {
  createDb,
  customer,
  type MarketingAttribution,
  marketingAutomation,
  marketingCampaign,
  marketingMessage,
  marketingSession,
  order,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  dismissRecommendation,
  recommendationsFor,
} from '../src/services/growth-recommendations.service'
import { campaignReport } from '../src/services/growth-report.service'
import { marketingOverview } from '../src/services/marketing-overview.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000)
const daysAgo = (n: number) => hoursAgo(n * 24)

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

async function newCustomer(
  storeId: string,
  email: string,
  extra: Partial<typeof customer.$inferInsert> = {},
) {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, email, ...extra })
    .returning()
  return c?.id as string
}

let orderNumber = 1
async function placed(
  storeId: string,
  totalPaise: number,
  opts: {
    at?: Date
    customerId?: string
    attribution?: Partial<MarketingAttribution> | null
    paymentMethod?: string
  } = {},
) {
  await owner.insert(order).values({
    storeId,
    number: orderNumber++,
    status: 'open',
    subtotalPaise: totalPaise,
    totalPaise,
    placedAt: opts.at ?? hoursAgo(1),
    customerId: opts.customerId ?? null,
    paymentMethod: opts.paymentMethod ?? null,
    attribution: opts.attribution
      ? ({ at: hoursAgo(2).toISOString(), ...opts.attribution } as MarketingAttribution)
      : null,
  })
}

describe('overview: first-time vs returning and the shop-wide tiles', () => {
  it('splits each channel and source by buyer type and adds total sales and AOV', async () => {
    const storeId = await newStore('g1')
    const repeat = await newCustomer(storeId, 'repeat@x.in')
    const fresh = await newCustomer(storeId, 'fresh@x.in')
    // An order before the range makes `repeat` a returning buyer inside it.
    await placed(storeId, 10000, { customerId: repeat, at: daysAgo(40) })
    await placed(storeId, 30000, {
      customerId: repeat,
      attribution: { channel: 'social', source: 'instagram' },
    })
    await placed(storeId, 50000, {
      customerId: fresh,
      attribution: { channel: 'social', source: 'instagram' },
    })
    await placed(storeId, 20000, {})

    const o = await withStore(app, storeId, (tx) => marketingOverview(tx, { range: { key: '7d' } }))
    const social = o.channels.find((c) => c.channel === 'social')
    expect(social?.split).toEqual({
      newOrders: 1,
      newSalesPaise: 50000,
      returningOrders: 1,
      returningSalesPaise: 30000,
    })
    expect(o.sources.find((s) => s.source === 'instagram')?.split.returningOrders).toBe(1)
    // The guest order counts as first-time.
    expect(o.channels.find((c) => c.channel === 'untracked')?.split.newOrders).toBe(1)
    const kpi = Object.fromEntries(o.kpis.map((k) => [k.id, k]))
    expect(kpi.total_sales?.value).toBe(100000)
    expect(kpi.aov?.value).toBe(33333)
    expect(kpi.total_sales?.delta).toBeNull()
  })
})

describe('campaign report', () => {
  it('builds the funnel, rates, buyer split and landing pages for an email', async () => {
    const storeId = await newStore('g2')
    const startedAt = daysAgo(2)
    const [c] = await owner
      .insert(marketingCampaign)
      .values({ storeId, kind: 'email', name: 'Diwali Drop', status: 'sent', startedAt })
      .returning()
    const id = c?.id as string
    const quitter = await newCustomer(storeId, 'quit@x.in', { unsubscribedAt: daysAgo(1) })
    const buyer = await newCustomer(storeId, 'buy@x.in')
    await owner.insert(marketingMessage).values([
      {
        storeId,
        campaignId: id,
        channel: 'email',
        to: 'quit@x.in',
        customerId: quitter,
        status: 'sent',
        sentAt: startedAt,
        openedAt: hoursAgo(30),
      },
      {
        storeId,
        campaignId: id,
        channel: 'email',
        to: 'buy@x.in',
        customerId: buyer,
        status: 'sent',
        sentAt: startedAt,
        openedAt: hoursAgo(30),
      },
      {
        storeId,
        campaignId: id,
        channel: 'email',
        to: 'c@x.in',
        status: 'sent',
        sentAt: startedAt,
      },
      { storeId, campaignId: id, channel: 'email', to: 'd@x.in', status: 'failed' },
    ])
    await owner.insert(marketingSession).values([
      {
        storeId,
        visitorId: 'v1',
        channel: 'email',
        campaignId: id,
        landingPath: '/collections/new?x=1',
        startedAt: hoursAgo(20),
      },
      {
        storeId,
        visitorId: 'v2',
        channel: 'email',
        campaignId: id,
        landingPath: '/collections/new',
        startedAt: hoursAgo(20),
      },
      // A copied link carries only the utm tag.
      {
        storeId,
        visitorId: 'v3',
        channel: 'email',
        campaign: 'diwali-drop',
        landingPath: '/',
        startedAt: hoursAgo(20),
      },
      // Before sending began: not this campaign's.
      {
        storeId,
        visitorId: 'v4',
        channel: 'email',
        campaignId: id,
        landingPath: '/',
        startedAt: daysAgo(5),
      },
    ])
    await placed(storeId, 40000, {
      customerId: buyer,
      attribution: { channel: 'email', campaignId: id, landing: '/collections/new' },
    })

    const r = await withStore(app, storeId, (tx) =>
      campaignReport(tx, { id, kind: 'email', name: 'Diwali Drop', startedAt }),
    )
    expect(r.funnel.map((s) => [s.id, s.value])).toEqual([
      ['sent', 4],
      ['delivered', 3],
      ['opened', 2],
      ['visited', 3],
      ['carted', 0],
      ['ordered', 1],
    ])
    expect(r.omitted).toEqual([])
    expect(r.rates.delivery?.rate).toBeCloseTo(0.75)
    expect(r.rates.unsubscribe).toMatchObject({ part: 1, whole: 3 })
    expect(r.rates.bounce).toBeNull()
    expect(r.rates.complaint).toBeNull()
    expect(r.split).toMatchObject({ newOrders: 1, newSalesPaise: 40000, returningOrders: 0 })
    expect(r.links[0]).toEqual({
      path: '/collections/new',
      visits: 2,
      orders: 1,
      salesPaise: 40000,
    })
    // The over-time chart: one row per day since sending began, adding up to the funnel.
    expect(r.daily.length).toBeGreaterThanOrEqual(1)
    expect(r.daily.length).toBeLessThanOrEqual(30)
    const sum = (key: 'sessions' | 'orders' | 'salesPaise') =>
      r.daily.reduce((n, d) => n + d[key], 0)
    expect([sum('sessions'), sum('orders'), sum('salesPaise')]).toEqual([3, 1, 40000])
  })

  it('leaves opens out of a WhatsApp funnel', async () => {
    const storeId = await newStore('g3')
    const startedAt = daysAgo(1)
    const [c] = await owner
      .insert(marketingCampaign)
      .values({ storeId, kind: 'whatsapp', name: 'Restock', status: 'sent', startedAt })
      .returning()
    const r = await withStore(app, storeId, (tx) =>
      campaignReport(tx, { id: c?.id as string, kind: 'whatsapp', name: 'Restock', startedAt }),
    )
    expect(r.omitted).toEqual(['opened'])
    expect(r.rates.open).toBeNull()
  })
})

describe('growth recommendations', () => {
  it('works out the cards from the store numbers', async () => {
    const storeId = await newStore('g4')
    await owner.insert(marketingAutomation).values([
      {
        storeId,
        template: 'win_back',
        trigger: 'customer_lapsed',
        name: 'Win back',
        status: 'paused',
      },
      {
        storeId,
        template: 'welcome_subscriber',
        trigger: 'customer_subscribed',
        name: 'Hi',
        status: 'active',
      },
    ])
    for (let i = 0; i < 5; i += 1) {
      const id = await newCustomer(storeId, `old${i}@x.in`, { acceptsMarketing: true })
      await placed(storeId, 9000, { customerId: id, at: daysAgo(120) })
    }
    for (let i = 0; i < 10; i += 1) {
      await placed(storeId, 1000, { paymentMethod: i < 6 ? 'cod' : 'upi' })
    }

    const recs = await withStore(app, storeId, (tx) => recommendationsFor(tx, storeId))
    // Abandoned checkouts: none waiting. Welcome: on. Campaign: too few subscribers.
    expect(recs.map((r) => r.id)).toEqual(['cod_confirmation', 'win_back'])
    expect(recs[0]).toMatchObject({
      numbers: { cod: 6, total: 10 },
      action: { kind: 'create_automation', template: 'cod_confirmation' },
    })
    expect(recs[1]?.numbers.customers).toBe(5)
    expect(recs[1]?.action).toMatchObject({ kind: 'open' })
  })

  it('remembers a dismissal for the store', async () => {
    const storeId = await newStore('g5')
    for (let i = 0; i < 12; i += 1) {
      await newCustomer(storeId, `s${i}@x.in`, { acceptsMarketing: true })
    }
    const before = await withStore(app, storeId, (tx) => recommendationsFor(tx, storeId))
    expect(before.map((r) => r.id)).toContain('campaign')
    const after = await withStore(app, storeId, (tx) =>
      dismissRecommendation(tx, storeId, 'campaign'),
    )
    expect(after.map((r) => r.id)).not.toContain('campaign')
    const [row] = await owner
      .select({ p: store.preferences })
      .from(store)
      .where(eq(store.id, storeId))
    expect(
      (row?.p as { growthRecommendations?: unknown } | undefined)?.growthRecommendations,
    ).toMatchObject({
      dismissed: { campaign: expect.any(String) },
    })
  })
})

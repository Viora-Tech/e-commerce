import { recordMarketingSession } from '@commerce/core'
import { attributionFromVisit } from '@commerce/core/marketing'
import {
  createDb,
  type MarketingAttribution,
  marketingCampaign,
  order,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { marketingOverview, normalizeSource } from '../src/services/marketing-overview.service'

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

async function newStore(slug: string) {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  return s?.id as string
}

async function session(storeId: string, url: string, referrer?: string) {
  await withStore(app, storeId, (tx) =>
    recordMarketingSession(tx, storeId, {
      visitorId: crypto.randomUUID(),
      attribution: attributionFromVisit({ landingUrl: url, referrer, now: hoursAgo(2) }),
    }),
  )
}

let orderNumber = 1
async function placed(
  storeId: string,
  totalPaise: number,
  attribution: Partial<MarketingAttribution> | null,
  status: 'open' | 'draft' | 'cancelled' = 'open',
) {
  await owner.insert(order).values({
    storeId,
    number: orderNumber++,
    status,
    subtotalPaise: totalPaise,
    totalPaise,
    placedAt: hoursAgo(1),
    attribution: attribution
      ? ({ at: hoursAgo(2).toISOString(), ...attribution } as MarketingAttribution)
      : null,
  })
}

describe('marketing overview', () => {
  it('credits sessions and sales to channels and campaigns', async () => {
    const storeId = await newStore('m1')
    const [campaign] = await owner
      .insert(marketingCampaign)
      .values({ storeId, kind: 'email', name: 'Diwali launch' })
      .returning()
    await session(storeId, 'https://s.in/?utm_source=instagram&utm_medium=social&utm_campaign=drop')
    await session(storeId, 'https://s.in/?utm_source=instagram&utm_medium=social&utm_campaign=drop')
    await session(storeId, 'https://s.in/', 'https://www.google.com/')
    await session(storeId, 'https://s.in/')
    await placed(storeId, 200000, {
      channel: 'social',
      source: 'instagram',
      medium: 'social',
      campaign: 'drop',
    })
    await placed(storeId, 150000, { channel: 'email', campaignId: campaign?.id as string })
    await placed(storeId, 90000, { channel: 'direct' })
    await placed(storeId, 50000, null)
    await placed(storeId, 999900, { channel: 'social' }, 'draft')
    await placed(storeId, 999900, { channel: 'social' }, 'cancelled')

    const o = await withStore(app, storeId, (tx) => marketingOverview(tx, { range: { key: '7d' } }))
    const kpi = Object.fromEntries(o.kpis.map((k) => [k.id, k.value]))
    expect(kpi.sessions).toBe(4)
    expect(kpi.attributed_sales).toBe(350000)
    expect(kpi.attributed_orders).toBe(2)
    expect(kpi.conversion).toBe(0.75)

    const social = o.channels.find((c) => c.channel === 'social')
    expect(social).toMatchObject({ sessions: 2, orders: 1, salesPaise: 200000, conversion: 0.5 })
    expect(o.channels.find((c) => c.channel === 'organic_search')?.sessions).toBe(1)
    expect(o.channels.find((c) => c.channel === 'untracked')?.orders).toBe(1)

    const drop = o.campaigns.find((c) => c.key === 'utm:drop')
    expect(drop).toMatchObject({ kind: 'utm', sessions: 2, orders: 1, salesPaise: 200000 })
    const ours = o.campaigns.find((c) => c.name === 'Diwali launch')
    expect(ours).toMatchObject({
      kind: 'email',
      orders: 1,
      salesPaise: 150000,
      href: `/growth/campaigns/${campaign?.id}`,
      sourceKey: 'email',
    })

    const instagram = o.sources.find((s) => s.source === 'instagram')
    expect(instagram).toMatchObject({ sessions: 2, orders: 1, salesPaise: 200000 })
    const direct = o.sources.find((s) => s.source === 'direct')
    expect(direct).toMatchObject({ orders: 2 }) // the direct order and the untracked (null) order
    expect(o.bestSource).toBe('instagram')
    const total = o.sources.reduce((n, s) => n + s.salesPaise, 0)
    for (const s of o.sources) expect(s.shareOfSales).toBeCloseTo(s.salesPaise / total, 5)
    expect(drop?.sourceKey).toBe('instagram')
  })

  it('normalises sources to plain merchant-facing names', () => {
    expect(
      normalizeSource({ source: 'instagram', medium: 'social', referrer: null, channel: 'social' }),
    ).toBe('instagram')
    expect(
      normalizeSource({
        source: null,
        medium: null,
        referrer: 'l.instagram.com',
        channel: 'social',
      }),
    ).toBe('instagram')
    expect(normalizeSource({ source: 'ig', medium: null, referrer: null, channel: null })).toBe(
      'instagram',
    )
    expect(
      normalizeSource({ source: 'google', medium: 'cpc', referrer: null, channel: 'paid_search' }),
    ).toBe('google')
    expect(
      normalizeSource({
        source: null,
        medium: null,
        referrer: 'chat.openai.com',
        channel: 'ai_assistant',
      }),
    ).toBe('ai_assistant')
    expect(
      normalizeSource({ source: null, medium: null, referrer: null, channel: 'whatsapp' }),
    ).toBe('whatsapp')
    expect(normalizeSource({ source: null, medium: null, referrer: null, channel: 'email' })).toBe(
      'email',
    )
    expect(normalizeSource({ source: null, medium: null, referrer: null, channel: 'direct' })).toBe(
      'direct',
    )
    expect(normalizeSource({ source: null, medium: null, referrer: null, channel: null })).toBe(
      'direct',
    )
    expect(
      normalizeSource({
        source: null,
        medium: null,
        referrer: 'news.example.com',
        channel: 'referral',
      }),
    ).toBe('other')
  })

  it('keeps each store to its own sessions and orders', async () => {
    const a = await newStore('ma')
    const b = await newStore('mb')
    await session(a, 'https://s.in/?utm_source=google&utm_medium=cpc')
    await placed(a, 100000, { channel: 'paid_search' })
    const o = await withStore(app, b, (tx) => marketingOverview(tx, { range: { key: '7d' } }))
    expect(o.kpis.every((k) => k.value === 0)).toBe(true)
    expect(o.channels).toEqual([])
    expect(o.campaigns).toEqual([])
  })
})

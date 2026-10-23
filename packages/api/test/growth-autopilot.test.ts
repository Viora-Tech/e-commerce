import { recordMarketingSession } from '@commerce/core'
import { attributionFromVisit } from '@commerce/core/marketing'
import {
  createDb,
  customer,
  discount,
  type MarketingAttribution,
  marketingCampaign,
  order,
  product,
  shortLink,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreScope } from '../src/procedures'
import { campaignPerformance } from '../src/services/campaign-performance.service'
import {
  approveAutopilotProposal,
  dismissAutopilotProposal,
  planAutopilotCampaigns,
  saveAutopilotSettings,
} from '../src/services/growth-autopilot.service'
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

const DAY = 86_400_000
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
  extra: { customerId?: string; placedAt?: Date } = {},
) {
  await owner.insert(order).values({
    storeId,
    number: orderNumber++,
    status: 'open',
    subtotalPaise: totalPaise,
    totalPaise,
    placedAt: extra.placedAt ?? hoursAgo(1),
    customerId: extra.customerId ?? null,
    attribution: attribution
      ? ({ at: hoursAgo(2).toISOString(), ...attribution } as MarketingAttribution)
      : null,
  })
}

const scopeFor = (storeId: string) => ({ storeId, userId: 'u1' }) as unknown as StoreScope

describe('growth overview, Shopify layout', () => {
  it('buckets sessions by traffic type and lines up the previous period', async () => {
    const storeId = await newStore('g1')
    await session(storeId, 'https://s.in/')
    await session(storeId, 'https://s.in/', 'https://www.google.com/')
    await session(storeId, 'https://s.in/?utm_source=google&utm_medium=cpc&utm_campaign=x')
    const o = await withStore(app, storeId, (tx) => marketingOverview(tx, { range: { key: '7d' } }))
    expect(o.trafficTypes).toEqual({ direct: 1, paid: 1, organic: 1, unknown: 0 })
    const attributed = o.kpis.find((k) => k.id === 'attributed_sales')
    expect(attributed?.previousSeries).toHaveLength(7)
  })

  it('groups our sends and tracking-link campaigns with this year’s sessions and sales', async () => {
    const storeId = await newStore('g2')
    const [c] = await owner
      .insert(marketingCampaign)
      .values({ storeId, kind: 'email', name: 'Diwali Drop' })
      .returning()
    await session(storeId, 'https://s.in/?utm_source=whatsapp&utm_campaign=diwali-drop')
    await session(storeId, 'https://s.in/?utm_source=instagram&utm_campaign=bio-oct')
    await placed(storeId, 50_000, { channel: 'email', campaignId: c?.id as string })
    await placed(storeId, 20_000, { channel: 'social', campaign: 'bio-oct' })
    await owner.insert(shortLink).values({
      storeId,
      slug: 'bio',
      name: 'Bio',
      destination: '/',
      utmCampaign: 'bio-oct',
    })
    const rows = await withStore(app, storeId, (tx) => campaignPerformance(tx))
    const ours = rows.find((r) => r.id === c?.id)
    expect(ours).toMatchObject({ kind: 'email', sessions: 1, orders: 1, salesPaise: 50_000 })
    const utm = rows.find((r) => r.key === 'utm:bio-oct')
    expect(utm).toMatchObject({ kind: 'utm', sessions: 1, orders: 1, salesPaise: 20_000, links: 1 })
  })
})

describe('campaign autopilot', () => {
  async function seed(storeId: string) {
    const people = await owner
      .insert(customer)
      .values(
        Array.from({ length: 12 }, (_, i) => ({
          storeId,
          name: `C${i}`,
          email: `c${i}@example.com`,
          acceptsMarketing: true,
        })),
      )
      .returning()
    for (const p of people.slice(0, 6)) {
      await placed(storeId, 10_000, null, {
        customerId: p.id,
        placedAt: new Date(Date.now() - 120 * DAY),
      })
    }
    await owner
      .insert(product)
      .values({ storeId, handle: 'new-pad', title: 'New Pad', status: 'active' })
  }

  it('plans drafts only when on, and approve schedules with a capped discount code', async () => {
    const storeId = await newStore('g3')
    await seed(storeId)
    const context = { db: app, scope: scopeFor(storeId) }
    await expect(planAutopilotCampaigns(context)).rejects.toThrow(/Autopilot on/)

    await withStore(app, storeId, (tx) =>
      saveAutopilotSettings(tx, storeId, {
        enabled: true,
        goals: ['win_back', 'new_products'],
        maxMessagesPerWeek: 1000,
        maxCampaignsPerWeek: 3,
        maxDiscountPercent: 8,
      }),
    )
    const planned = await planAutopilotCampaigns(context)
    expect(planned.proposals.map((p) => p.goal).sort()).toEqual(['new_products', 'win_back'])
    expect(planned.proposals.every((p) => p.campaign?.subject)).toBe(true)
    const winBack = planned.proposals.find((p) => p.goal === 'win_back')
    expect(winBack?.discountPercent).toBe(8)
    expect(winBack?.campaign?.segmentName).toBe('Autopilot: no order in 90 days')

    // Planning again proposes nothing new while those wait.
    const again = await planAutopilotCampaigns(context)
    expect(again.proposals).toHaveLength(2)

    const approved = await withStore(app, storeId, (tx) =>
      approveAutopilotProposal(tx, storeId, winBack?.id as string),
    )
    expect(approved.proposals.find((p) => p.id === winBack?.id)?.status).toBe('scheduled')
    const [row] = await owner
      .select()
      .from(marketingCampaign)
      .where(eq(marketingCampaign.id, winBack?.campaignId as string))
    expect(row?.status).toBe('scheduled')
    const codes = await owner.select().from(discount).where(eq(discount.storeId, storeId))
    expect(codes).toHaveLength(1)
    expect(codes[0]?.value).toBe(800)

    const other = planned.proposals.find((p) => p.goal === 'new_products')
    await withStore(app, storeId, (tx) =>
      dismissAutopilotProposal(tx, storeId, other?.id as string),
    )
    const gone = await owner
      .select()
      .from(marketingCampaign)
      .where(eq(marketingCampaign.id, other?.campaignId as string))
    expect(gone).toHaveLength(0)
  })
})

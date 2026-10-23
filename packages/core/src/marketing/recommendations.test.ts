/** SOURCE OF TRUTH: growth recommendations rules tests — WHAT covers when each recommendation fires, its action (create from template or open) and reading dismissed ids from store preferences / WHY a wrong rule nags merchants or hides money left on the table */
import { describe, expect, it } from 'vitest'
import {
  type GrowthFacts,
  growthRecommendations,
  parseGrowthRecommendationPrefs,
  visibleRecommendations,
} from './recommendations'

const quiet: GrowthFacts = {
  automations: {
    abandoned_checkout: { status: 'active', id: 'a1' },
    welcome_subscriber: { status: 'active', id: 'a2' },
    win_back: { status: 'active', id: 'a3' },
    cod_confirmation: { status: 'active', id: 'a4' },
  },
  abandoned: { carts: 0, valuePaise: 0 },
  newSubscribers: { last30: 0, previous30: 0 },
  lapsedCustomers: 0,
  orders30: { total: 0, cod: 0 },
  daysSinceCampaign: 3,
  campaignPending: false,
  subscribers: 0,
  quietLinks: [],
}

const ids = (facts: GrowthFacts) => growthRecommendations(facts).map((r) => r.id)

describe('growth recommendations', () => {
  it('has nothing to say for a store with everything on', () => {
    expect(growthRecommendations(quiet)).toEqual([])
  })

  it('creates the abandoned-checkout automation when it is missing', () => {
    const [rec] = growthRecommendations({
      ...quiet,
      automations: { ...quiet.automations, abandoned_checkout: { status: 'missing' } },
      abandoned: { carts: 4, valuePaise: 1_250_000 },
    })
    expect(rec).toEqual({
      id: 'abandoned_checkout',
      numbers: { carts: 4, valuePaise: 1_250_000 },
      action: { kind: 'create_automation', template: 'abandoned_checkout' },
    })
  })

  it('opens a paused automation instead of creating a second one', () => {
    const [rec] = growthRecommendations({
      ...quiet,
      automations: { ...quiet.automations, win_back: { status: 'paused', id: 'w1' } },
      lapsedCustomers: 12,
    })
    expect(rec?.action).toEqual({ kind: 'open', href: '/growth/automations/w1' })
  })

  it('needs enough cash-on-delivery orders before suggesting confirmations', () => {
    const cod = { ...quiet.automations, cod_confirmation: { status: 'missing' } as const }
    expect(ids({ ...quiet, automations: cod, orders30: { total: 5, cod: 5 } })).toEqual([])
    expect(ids({ ...quiet, automations: cod, orders30: { total: 20, cod: 7 } })).toEqual([])
    expect(ids({ ...quiet, automations: cod, orders30: { total: 20, cod: 12 } })).toEqual([
      'cod_confirmation',
    ])
  })

  it('suggests a welcome only while signups are holding up', () => {
    const welcome = { ...quiet.automations, welcome_subscriber: { status: 'missing' } as const }
    expect(
      ids({ ...quiet, automations: welcome, newSubscribers: { last30: 6, previous30: 4 } }),
    ).toEqual(['welcome'])
    expect(
      ids({ ...quiet, automations: welcome, newSubscribers: { last30: 2, previous30: 9 } }),
    ).toEqual([])
  })

  it('suggests a campaign after a quiet month with subscribers, unless one is on its way', () => {
    const base = { ...quiet, subscribers: 40 }
    expect(ids({ ...base, daysSinceCampaign: 45 })).toEqual(['campaign'])
    expect(ids({ ...base, daysSinceCampaign: null })).toEqual(['campaign'])
    expect(ids({ ...base, daysSinceCampaign: 10 })).toEqual([])
    expect(ids({ ...base, daysSinceCampaign: 45, campaignPending: true })).toEqual([])
    expect(ids({ ...base, subscribers: 3, daysSinceCampaign: 45 })).toEqual([])
  })

  it('names the most clicked link that brought no orders', () => {
    const [rec] = growthRecommendations({
      ...quiet,
      quietLinks: [
        { id: 'l1', name: 'Bio link', clicks: 64 },
        { id: 'l2', name: 'Story', clicks: 5 },
      ],
    })
    expect(rec).toMatchObject({ id: 'links_no_orders', name: 'Bio link', numbers: { clicks: 64 } })
  })

  it('shows at most three, skipping dismissed ones', () => {
    const all = growthRecommendations({
      ...quiet,
      automations: {
        abandoned_checkout: { status: 'missing' },
        welcome_subscriber: { status: 'missing' },
        win_back: { status: 'missing' },
        cod_confirmation: { status: 'missing' },
      },
      abandoned: { carts: 2, valuePaise: 500_00 },
      newSubscribers: { last30: 5, previous30: 1 },
      lapsedCustomers: 30,
      orders30: { total: 30, cod: 20 },
      subscribers: 100,
      daysSinceCampaign: null,
    })
    expect(all.map((r) => r.id)).toEqual([
      'abandoned_checkout',
      'cod_confirmation',
      'win_back',
      'welcome',
      'campaign',
    ])
    expect(visibleRecommendations(all, new Set()).map((r) => r.id)).toEqual([
      'abandoned_checkout',
      'cod_confirmation',
      'win_back',
    ])
    expect(
      visibleRecommendations(all, new Set(['cod_confirmation', 'win_back'])).map((r) => r.id),
    ).toEqual(['abandoned_checkout', 'welcome', 'campaign'])
  })
})

describe('dismissal preferences', () => {
  it('reads known ids and ignores anything broken', () => {
    expect(parseGrowthRecommendationPrefs(null)).toEqual({ dismissed: {} })
    expect(parseGrowthRecommendationPrefs({ growthRecommendations: 'x' })).toEqual({
      dismissed: {},
    })
    expect(
      parseGrowthRecommendationPrefs({
        mcp: {},
        growthRecommendations: {
          dismissed: { win_back: '2026-10-01T00:00:00.000Z', nope: 'x', welcome: 3 },
        },
      }),
    ).toEqual({ dismissed: { win_back: '2026-10-01T00:00:00.000Z' } })
  })
})

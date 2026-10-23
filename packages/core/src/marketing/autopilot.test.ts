/** SOURCE OF TRUTH: Campaign Autopilot planner tests — WHAT covers goals, caps, festival timing, waiting proposals and the stored-state parser / WHY Autopilot must never plan past the merchant's limits */
import { describe, expect, it } from 'vitest'
import {
  type AutopilotFacts,
  type AutopilotProposal,
  AutopilotSettingsSchema,
  autopilotDiscountCode,
  parseAutopilotState,
  planAutopilot,
  templateMessage,
  trimProposals,
} from './autopilot'

const now = new Date('2026-10-23T06:00:00Z')

const facts: AutopilotFacts = {
  now,
  subscribers: 500,
  lapsedCustomers: 40,
  abandoned: { carts: 6, valuePaise: 1_20_000_00 },
  cartAutomation: { status: 'missing' },
  newProducts: 3,
  campaignsThisWeek: 0,
  messagesThisWeek: 0,
}

const settings = AutopilotSettingsSchema.parse({ enabled: true, maxCampaignsPerWeek: 7 })

const proposal = (over: Partial<AutopilotProposal>): AutopilotProposal => ({
  id: 'p1',
  goal: 'win_back',
  kind: 'campaign',
  campaignId: null,
  festival: null,
  sendAt: '2026-10-25T04:30:00.000Z',
  audience: 40,
  discountPercent: 10,
  numbers: {},
  aiWritten: false,
  status: 'proposed',
  createdAt: '2026-10-22T00:00:00.000Z',
  ...over,
})

describe('planAutopilot', () => {
  it('plans nothing while Autopilot is off', () => {
    expect(planAutopilot(facts, { ...settings, enabled: false }, [])).toEqual([])
  })

  it('plans each chosen goal whose numbers call for it', () => {
    const goals = planAutopilot(facts, settings, []).map((i) => i.goal)
    expect(goals).toEqual(['recover_carts', 'festive', 'new_products', 'win_back'])
  })

  it('times the festive campaign three days before the festival at 10:00 IST', () => {
    const festive = planAutopilot(facts, settings, []).find((i) => i.goal === 'festive')
    expect(festive?.festival?.name).toBe('Dhanteras')
    expect(festive?.sendAt.toISOString()).toBe('2026-11-03T04:30:00.000Z')
  })

  it('never offers more than the discount cap', () => {
    const items = planAutopilot(facts, { ...settings, maxDiscountPercent: 5 }, [])
    expect(Math.max(...items.map((i) => i.discountPercent))).toBe(5)
    const none = planAutopilot(facts, { ...settings, maxDiscountPercent: 0 }, [])
    expect(none.every((i) => i.discountPercent === 0)).toBe(true)
  })

  it('stays within the weekly campaign and message caps', () => {
    const two = planAutopilot(facts, { ...settings, maxCampaignsPerWeek: 2 }, [])
    expect(two.filter((i) => i.kind === 'campaign')).toHaveLength(2)
    const small = planAutopilot(facts, { ...settings, maxMessagesPerWeek: 100 }, [])
    expect(small.filter((i) => i.kind === 'campaign').map((i) => i.goal)).toEqual(['win_back'])
    const busy = planAutopilot({ ...facts, campaignsThisWeek: 7 }, settings, [])
    expect(busy.filter((i) => i.kind === 'campaign')).toEqual([])
  })

  it('skips goals already waiting for approval and cart reminders that are on', () => {
    const items = planAutopilot(
      { ...facts, cartAutomation: { status: 'active', id: 'a1' } },
      settings,
      [proposal({ goal: 'win_back' })],
    )
    expect(items.map((i) => i.goal)).toEqual(['festive', 'new_products'])
  })

  it('does not plan the same festival twice', () => {
    const items = planAutopilot(facts, settings, [
      proposal({ goal: 'festive', festival: 'dhanteras-2026', status: 'scheduled' }),
    ])
    expect(items.some((i) => i.goal === 'festive')).toBe(false)
  })
})

describe('helpers', () => {
  it('plans a festive campaign only with a festival inside three weeks', () => {
    const later = { ...facts, now: new Date('2027-05-01T00:00:00Z') }
    expect(planAutopilot(later, settings, []).some((i) => i.goal === 'festive')).toBe(false)
  })

  it('reads stored state and falls back to defaults', () => {
    expect(parseAutopilotState(null).settings.enabled).toBe(false)
    expect(
      parseAutopilotState({ growthAutopilot: { settings: { enabled: true } } }).settings,
    ).toMatchObject({
      enabled: true,
      maxDiscountPercent: 10,
    })
    expect(parseAutopilotState({ growthAutopilot: 'junk' }).proposals).toEqual([])
  })

  it('keeps waiting proposals when trimming', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      proposal({
        id: `d${i}`,
        status: 'dismissed',
        createdAt: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    )
    const kept = trimProposals([proposal({ id: 'wait' }), ...many])
    expect(kept).toHaveLength(30)
    expect(kept[0]?.id).toBe('wait')
  })

  it('writes a template that only mentions a discount when there is one', () => {
    const base = {
      goal: 'win_back' as const,
      storeName: 'Waimers',
      festival: null,
      productTitles: [],
    }
    expect(templateMessage({ ...base, discountPercent: 0 }).body).not.toContain('%')
    expect(templateMessage({ ...base, discountPercent: 15 }).body).toContain('15% off')
  })

  it('makes discount codes the discount schema accepts', () => {
    expect(autopilotDiscountCode('win_back', 15, 'ab12-cd34')).toMatch(/^[A-Z0-9-]+$/)
  })
})

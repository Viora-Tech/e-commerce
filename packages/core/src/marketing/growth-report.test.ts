/** SOURCE OF TRUTH: growth report maths tests — WHAT covers the paid/organic channel filter, the first-time vs returning split, the campaign funnel with omitted steps and rates that are "not reported" rather than 0 / WHY the overview and campaign report must show the same numbers the rules promise */
import { describe, expect, it } from 'vitest'
import {
  type CampaignCounts,
  campaignFunnel,
  campaignRates,
  channelMatches,
  splitByCustomerType,
  trafficType,
} from './growth-report'

const email: CampaignCounts = {
  channel: 'email',
  attempted: 200,
  accepted: 190,
  opened: 95,
  visits: 38,
  carts: 10,
  orders: 4,
  unsubscribed: 2,
}

describe('channel filter', () => {
  it('splits paid from organic and keeps untracked under all only', () => {
    expect(channelMatches('paid_social', 'paid')).toBe(true)
    expect(channelMatches('other_paid', 'paid')).toBe(true)
    expect(channelMatches('social', 'paid')).toBe(false)
    expect(channelMatches('social', 'organic')).toBe(true)
    expect(channelMatches('direct', 'organic')).toBe(true)
    expect(channelMatches('paid_search', 'organic')).toBe(false)
    expect(channelMatches('untracked', 'organic')).toBe(false)
    expect(channelMatches('untracked', 'paid')).toBe(false)
    expect(channelMatches('untracked', 'all')).toBe(true)
  })
})

describe('customer split', () => {
  it('adds orders and sales to first-time or returning', () => {
    expect(
      splitByCustomerType([
        { totalPaise: 1000, returning: false },
        { totalPaise: 2500, returning: true },
        { totalPaise: 500, returning: false },
      ]),
    ).toEqual({ newOrders: 2, newSalesPaise: 1500, returningOrders: 1, returningSalesPaise: 2500 })
  })
})

describe('campaign funnel', () => {
  it('runs sent → delivered → opened → visited → carted → ordered for email', () => {
    const { steps, omitted } = campaignFunnel(email)
    expect(steps.map((s) => s.id)).toEqual([
      'sent',
      'delivered',
      'opened',
      'visited',
      'carted',
      'ordered',
    ])
    expect(omitted).toEqual([])
    expect(steps[0]).toMatchObject({ value: 200, ofPrevious: 1, ofFirst: 1 })
    expect(steps[3]).toMatchObject({ value: 38, ofPrevious: 0.4, ofFirst: 0.19 })
  })

  it('leaves out what WhatsApp and untracked carts cannot measure', () => {
    const { steps, omitted } = campaignFunnel({ ...email, channel: 'whatsapp', carts: null })
    expect(omitted).toEqual(['opened', 'carted'])
    expect(steps.map((s) => s.id)).toEqual(['sent', 'delivered', 'visited', 'ordered'])
    // Visited is measured against delivered once opens are gone.
    expect(steps[2]?.ofPrevious).toBeCloseTo(38 / 190)
  })

  it('never divides by zero', () => {
    const { steps } = campaignFunnel({ ...email, attempted: 0, accepted: 0, opened: 0 })
    expect(steps.every((s) => Number.isFinite(s.ofPrevious) && Number.isFinite(s.ofFirst))).toBe(
      true,
    )
  })
})

describe('campaign rates', () => {
  it('reports what is recorded and null for what is not', () => {
    const r = campaignRates(email)
    expect(r.delivery).toEqual({ part: 190, whole: 200, rate: 0.95 })
    expect(r.open).toEqual({ part: 95, whole: 190, rate: 0.5 })
    expect(r.unsubscribe?.part).toBe(2)
    expect(r.bounce).toBeNull()
    expect(r.complaint).toBeNull()
  })

  it('has no open or unsubscribe rate for WhatsApp', () => {
    const r = campaignRates({ ...email, channel: 'whatsapp', unsubscribed: null })
    expect(r.open).toBeNull()
    expect(r.unsubscribe).toBeNull()
    expect(r.delivery?.rate).toBe(0.95)
  })
})

describe('traffic type', () => {
  it('buckets channels as Shopify does', () => {
    expect(trafficType('direct')).toBe('direct')
    expect(trafficType('paid_search')).toBe('paid')
    expect(trafficType('paid_social')).toBe('paid')
    expect(trafficType('organic_search')).toBe('organic')
    expect(trafficType('email')).toBe('organic')
    expect(trafficType('untracked')).toBe('unknown')
    expect(trafficType(null)).toBe('unknown')
    expect(trafficType('carrier_pigeon')).toBe('unknown')
  })
})

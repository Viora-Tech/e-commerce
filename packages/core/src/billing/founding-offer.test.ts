/** SOURCE OF TRUTH: founding offer rule tests — WHAT: who gets the price, the 20-place cap, counting the 12 months, renewal at the normal price, the invoice discount / WHY: the owner's 27 Nov 2026 offer must hold exactly and end on time */
import { describe, expect, it } from 'vitest'
import {
  canTakeFoundingPlace,
  FOUNDING_OFFER,
  foundingApplies,
  foundingDiscountPaise,
  foundingMonthsLeft,
  foundingNote,
  foundingPriceOf,
  foundingView,
  planPriceFor,
  withPlanGst,
} from './founding-offer'
import { projectNextBill } from './next-bill'
import { quotePlanChange } from './proration'

const at = new Date('2026-11-27T06:00:00Z')
const place = (monthsPaid: number) => ({ foundingOfferAt: at, monthsPaid })
const none = { foundingOfferAt: null, monthsPaid: 0 }

describe('founding offer', () => {
  it('is the owner’s 27 Nov offer: 20 places, 30-day trial, Growth ₹999 for 12 months', () => {
    expect(FOUNDING_OFFER).toMatchObject({
      slots: 20,
      trialDays: 30,
      plan: 'growth',
      interval: 'month',
      pricePaise: 99_900,
      months: 12,
    })
  })

  it('gives a place to the first 20 sign-ups only, and none once closed', () => {
    expect(canTakeFoundingPlace(0, true)).toBe(true)
    expect(canTakeFoundingPlace(19, true)).toBe(true)
    expect(canTakeFoundingPlace(20, true)).toBe(false)
    expect(canTakeFoundingPlace(35, true)).toBe(false)
    expect(canTakeFoundingPlace(0, false)).toBe(false)
  })

  it('applies to monthly Growth only, and only with a place', () => {
    expect(foundingApplies(place(0), 'growth', 'month')).toBe(true)
    expect(foundingApplies(place(0), 'growth', 'year')).toBe(false)
    expect(foundingApplies(place(0), 'pro', 'month')).toBe(false)
    expect(foundingApplies(place(0), 'starter', 'month')).toBe(false)
    expect(foundingApplies(none, 'growth', 'month')).toBe(false)
  })

  it('counts 12 paid months, then renews at the normal price', () => {
    expect(foundingMonthsLeft(place(0))).toBe(12)
    expect(foundingMonthsLeft(place(11))).toBe(1)
    expect(planPriceFor(place(11), 'growth', 'month')).toBe(99_900)
    expect(foundingMonthsLeft(place(12))).toBe(0)
    expect(planPriceFor(place(12), 'growth', 'month')).toBe(1_99_900)
    expect(planPriceFor(place(14), 'growth', 'month')).toBe(1_99_900)
    expect(planPriceFor(none, 'growth', 'month')).toBe(1_99_900)
  })

  it('bills ₹999 + GST as the normal line less a "Founding offer" discount', () => {
    expect(withPlanGst(1_99_900)).toBe(2_35_882)
    expect(withPlanGst(99_900)).toBe(1_17_882)
    expect(foundingDiscountPaise()).toBe(1_18_000)
    expect(foundingNote(place(2))).toBe('Founding offer: Growth at ₹999 a month, month 3 of 12')
  })

  it('shows the months on the page and prices the next bill', () => {
    const v = foundingView(place(3))
    expect(v).toEqual({
      pricePaise: 99_900,
      listPricePaise: 1_99_900,
      monthsTotal: 12,
      monthsPaid: 3,
      monthsLeft: 9,
    })
    expect(foundingView(none)).toBeNull()
    expect(foundingPriceOf(v, 'growth', 'month')).toBe(99_900)
    expect(foundingPriceOf(v, 'growth', 'year')).toBeNull()
    expect(foundingPriceOf(foundingView(place(12)), 'growth', 'month')).toBeNull()
    const base = {
      plan: 'growth' as const,
      nextPlan: null,
      interval: 'month' as const,
      periodEnd: at,
      trialEndsAt: null,
      fees: { feePaise: 0, carriedInPaise: 0, month: '2026-11' },
      renewingApps: [],
    }
    expect(projectNextBill({ ...base, founding: v })).toMatchObject({
      planPaise: 99_900,
      founding: true,
      totalPaise: 1_17_882,
    })
    expect(projectNextBill({ ...base, founding: foundingView(place(12)) })).toMatchObject({
      planPaise: 1_99_900,
      founding: false,
    })
  })

  it('quotes a trial choosing Growth at ₹999, and credits founding days on an upgrade', () => {
    const trial = {
      plan: 'growth' as const,
      interval: 'month' as const,
      status: 'trialing' as const,
      periodStart: null,
      periodEnd: null,
    }
    const q = quotePlanChange(trial, { plan: 'growth', interval: 'month' }, at, 0, {
      target: 99_900,
    })
    expect(q).toMatchObject({ kind: 'charge', netPaise: 99_900, totalPaise: 1_17_882 })
    // Founding Growth paid 1 Nov to 1 Dec, moving to Pro with half the month left.
    const start = new Date('2026-11-01T00:00:00Z')
    const end = new Date('2026-12-01T00:00:00Z')
    const mid = new Date('2026-11-16T00:00:00Z')
    const paid = { ...trial, status: 'active' as const, periodStart: start, periodEnd: end }
    const up = quotePlanChange(paid, { plan: 'pro', interval: 'month' }, mid, 0, {
      current: 99_900,
    })
    expect(up).toMatchObject({ kind: 'charge', creditPaise: 49_950 })
  })
})

/** SOURCE OF TRUTH: next bill and pace tests — WHAT: the Next bill card's sum, the month's pace,
 * the "Pro would save about ₹1,100" threshold and "Best value past ~N orders" / WHY: the page
 * must only suggest a bigger plan when the existing prices say it costs less. */
import { describe, expect, it } from 'vitest'
import { monthlyCost } from './cost-estimate'
import {
  breakEvenOrders,
  feesAtPace,
  type MonthPace,
  monthPace,
  projectNextBill,
  upgradeNudge,
} from './next-bill'

const pace = (projectedOrders: number, avgOrderPaise: number | null): MonthPace => ({
  orders: projectedOrders,
  salesPaise: (avgOrderPaise ?? 0) * projectedOrders,
  projectedOrders,
  avgOrderPaise,
})

describe('monthPace', () => {
  it('runs the month on at the same daily rate, today counted', () => {
    // 11 of 30 days: 182 orders → 496.
    expect(monthPace(182, 182 * 1_50_000, '2026-11-11')).toEqual({
      orders: 182,
      salesPaise: 2_73_00_000,
      projectedOrders: 496,
      avgOrderPaise: 1_50_000,
    })
    // February 2028 has 29 days; on the last day the pace is what happened.
    expect(monthPace(290, 0, '2028-02-29').projectedOrders).toBe(290)
    expect(monthPace(0, 0, '2026-11-01')).toMatchObject({ projectedOrders: 0, avgOrderPaise: null })
  })
})

describe('feesAtPace', () => {
  it('is the per-order fee monthlyCost charges at the projected orders', () => {
    // Starter: 300 orders at ₹1,500 → 250 past 50 at 1% = ₹3,750.
    expect(feesAtPace('starter', pace(300, 1_50_000))).toBe(3_750)
    expect(feesAtPace('growth', pace(150, 1_50_000))).toBe(0)
    expect(feesAtPace('scale', pace(5_000, 1_50_000))).toBe(0)
  })
})

describe('breakEvenOrders', () => {
  it('is the first order count where the plan costs no more than the one below', () => {
    const n = breakEvenOrders('pro', 1_00_000) as number
    // At ₹1,000 an order Growth is 499 + 7.5n past 500 and Pro is 2,499 + 5n: equal at 800.
    expect(n).toBe(800)
    expect(monthlyCost('pro', n, 1_000).totalInr).toBeLessThanOrEqual(
      monthlyCost('growth', n, 1_000).totalInr,
    )
    expect(monthlyCost('pro', n - 1, 1_000).totalInr).toBeGreaterThan(
      monthlyCost('growth', n - 1, 1_000).totalInr,
    )
  })

  it('has no answer for Starter, before the first order, or past the cap', () => {
    expect(breakEvenOrders('starter', 1_00_000)).toBeNull()
    expect(breakEvenOrders('pro', null)).toBeNull()
    // A ₹1 average order: the fee never catches up with the price gap.
    expect(breakEvenOrders('scale', 100)).toBeNull()
  })
})

describe('upgradeNudge', () => {
  it('suggests the bigger plan that saves the most, rounded to ₹100', () => {
    // Growth at 700 orders × ₹1,500: 1,999 + 500 × 11.25 = 7,624; Pro: 4,999 + 200 × 7.5 = 6,499.
    expect(upgradeNudge('growth', pace(700, 1_50_000))).toEqual({ plan: 'pro', savingInr: 1_100 })
  })

  it('stays quiet when a bigger plan would not cost less', () => {
    expect(upgradeNudge('growth', pace(182, 1_50_000))).toBeNull()
    // Close to the limit but still cheaper where it is.
    expect(upgradeNudge('growth', pace(400, 1_50_000))).toBeNull()
    expect(upgradeNudge('scale', pace(10_000, 1_50_000))).toBeNull()
    expect(upgradeNudge('growth', pace(700, null))).toBeNull()
  })

  it('needs a saving of at least ₹100', () => {
    // Growth vs Pro at ₹1,000 an order: equal at 800; at 839 Pro saves 2.5 × 39 = ₹97.5 → 98.
    expect(upgradeNudge('growth', pace(839, 1_00_000))).toBeNull()
    expect(upgradeNudge('growth', pace(840, 1_00_000))).toEqual({ plan: 'pro', savingInr: 100 })
  })
})

describe('projectNextBill', () => {
  const base = {
    plan: 'growth' as const,
    nextPlan: null,
    interval: 'month' as const,
    periodEnd: new Date('2026-11-30T18:30:00Z'),
    trialEndsAt: null,
    fees: { feePaise: 0, carriedInPaise: 0, month: '2026-11' },
    renewingApps: ['emi-pay-later'],
  }

  it('adds the plan, fees and renewing apps, with 18% GST (Figma 931:9997)', () => {
    expect(projectNextBill(base)).toEqual({
      plan: 'growth',
      interval: 'month',
      planPaise: 1_99_900,
      feesPaise: 0,
      feesMonth: '2026-11',
      apps: [{ pluginId: 'emi-pay-later', pricePaise: 149_00 }],
      appsPaise: 149_00,
      gstPaise: 38_664,
      totalPaise: 2_53_464,
      dueAt: base.periodEnd,
    })
  })

  it('counts fees with what was carried in, and a scheduled downgrade', () => {
    const bill = projectNextBill({
      ...base,
      plan: 'pro',
      nextPlan: 'starter',
      fees: { feePaise: 12_345, carriedInPaise: 5_000, month: '2026-11' },
      renewingApps: [],
    })
    expect(bill).toMatchObject({
      plan: 'starter',
      planPaise: 49_900,
      feesPaise: 17_345,
      gstPaise: 12_104, // 18% of 67,245 = 12,104.1
      totalPaise: 79_349,
    })
  })

  it('leaves out an app the renewing plan includes, and unknown apps', () => {
    expect(
      projectNextBill({ ...base, plan: 'pro', renewingApps: ['emi-pay-later', 'nope'] })?.apps,
    ).toEqual([])
  })

  it('falls back to the trial end, and is null with nothing to renew', () => {
    const trialEndsAt = new Date('2026-11-20T00:00:00Z')
    expect(projectNextBill({ ...base, periodEnd: null, trialEndsAt })?.dueAt).toBe(trialEndsAt)
    expect(projectNextBill({ ...base, periodEnd: null })).toBeNull()
  })
})

/** SOURCE OF TRUTH: plan change proration tests — WHAT: the "Move to Pro?" maths for up- and
 * downgrades mid-period, on the first and last day, yearly and across intervals / WHY: this is
 * what a merchant is charged, so every paisa is pinned. */
import { describe, expect, it } from 'vitest'
import { addInterval } from './plans'
import { type CurrentPlan, gstOn, paidPeriodEnd, quotePlanChange } from './proration'

const HOUR = 3_600_000
/** 1 Nov 2026, midnight in India; the month's period ends 1 Dec (30 days). */
const NOV1 = new Date('2026-10-31T18:30:00Z')
const DEC1 = addInterval(NOV1, 'month')

const growthMonthly: CurrentPlan = {
  plan: 'growth',
  interval: 'month',
  status: 'active',
  periodStart: NOV1,
  periodEnd: DEC1,
}

const charge = (q: ReturnType<typeof quotePlanChange>) => {
  if (q.kind !== 'charge') throw new Error(`expected a charge, got ${q.kind}`)
  return q
}

describe('days left', () => {
  it('counts today as unused: the whole period at its start, one day on its last', () => {
    const at = (ms: number) =>
      quotePlanChange(growthMonthly, { plan: 'pro', interval: 'month' }, new Date(ms))
    expect(at(NOV1.getTime())).toMatchObject({ newPlanDays: 30, creditDays: 30 })
    expect(at(DEC1.getTime() - 1)).toMatchObject({ newPlanDays: 1, creditDays: 1 })
    // At the end itself there is no paid time left: a full month at full price.
    expect(at(DEC1.getTime())).toMatchObject({ prorated: false, creditPaise: 0 })
  })
})

describe('gstOn', () => {
  it('is 18% rounded to the paisa', () => {
    expect(gstOn(2_00_000)).toBe(36_000)
    expect(gstOn(1)).toBe(0)
    expect(gstOn(3)).toBe(1) // 0.54 paise
    expect(gstOn(15_04_110)).toBe(2_70_740) // 270739.8
  })
})

describe('quotePlanChange', () => {
  it('Growth to Pro on 11 Nov: the Figma breakdown, to the paisa', () => {
    const now = new Date('2026-11-11T04:30:00Z') // 10:00 IST, 20 days left
    const q = charge(quotePlanChange(growthMonthly, { plan: 'pro', interval: 'month' }, now))
    expect(q).toMatchObject({
      plan: 'pro',
      interval: 'month',
      prorated: true,
      periodStart: now,
      periodEnd: DEC1,
      renewsAt: DEC1,
      newPlanDays: 20,
      newPlanPaise: 3_33_267, // 4,999 × 20/30 = 3,332.67
      creditPlan: 'growth',
      creditDays: 20,
      creditPaise: 1_33_267, // 1,999 × 20/30 = 1,332.67
      netPaise: 2_00_000,
      gstPaise: 36_000,
      planTotalPaise: 2_36_000,
      feesPaise: 0,
      totalPaise: 2_36_000,
      renewalPaise: 4_99_900,
    })
  })

  it('on the first day the whole old period is credited', () => {
    const q = charge(
      quotePlanChange(
        growthMonthly,
        { plan: 'pro', interval: 'month' },
        new Date(NOV1.getTime() + HOUR),
      ),
    )
    expect(q).toMatchObject({
      newPlanDays: 30,
      newPlanPaise: 4_99_900,
      creditPaise: 1_99_900,
      netPaise: 3_00_000,
      gstPaise: 54_000,
      totalPaise: 3_54_000,
      periodEnd: DEC1,
    })
  })

  it('on the last day one day is charged and credited', () => {
    const q = charge(
      quotePlanChange(
        growthMonthly,
        { plan: 'pro', interval: 'month' },
        new Date(DEC1.getTime() - HOUR),
      ),
    )
    expect(q).toMatchObject({
      newPlanDays: 1,
      newPlanPaise: 16_663, // 4,999 / 30 = 166.633…
      creditDays: 1,
      creditPaise: 6_663, // 1,999 / 30 = 66.633…
      netPaise: 10_000,
      gstPaise: 1_800,
      totalPaise: 11_800,
      periodEnd: DEC1,
    })
  })

  it('a downgrade mid-period is scheduled for the period end, nothing charged or refunded', () => {
    const now = new Date('2026-11-11T04:30:00Z')
    const pro: CurrentPlan = { ...growthMonthly, plan: 'pro' }
    expect(quotePlanChange(pro, { plan: 'growth', interval: 'month' }, now)).toEqual({
      kind: 'scheduled',
      plan: 'growth',
      interval: 'month',
      startsAt: DEC1,
    })
    // Same plan, yearly to monthly, is a downgrade too.
    const yearly: CurrentPlan = {
      ...growthMonthly,
      interval: 'year',
      periodEnd: addInterval(NOV1, 'year'),
    }
    expect(quotePlanChange(yearly, { plan: 'growth', interval: 'month' }, now).kind).toBe(
      'scheduled',
    )
  })

  it('the plan the store is already on, with paid time left, is nothing to do', () => {
    const now = new Date('2026-11-11T04:30:00Z')
    expect(quotePlanChange(growthMonthly, { plan: 'growth', interval: 'month' }, now)).toEqual({
      kind: 'same',
      plan: 'growth',
      interval: 'month',
    })
  })

  it('yearly to a bigger yearly plan: the rest of the year, pro rata over 365 days', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = addInterval(start, 'year')
    const now = new Date('2026-07-02T12:00:00Z') // 182.5 days left → 183
    const q = charge(
      quotePlanChange(
        { plan: 'growth', interval: 'year', status: 'active', periodStart: start, periodEnd: end },
        { plan: 'pro', interval: 'year' },
        now,
      ),
    )
    expect(q).toMatchObject({
      prorated: true,
      periodEnd: end,
      newPlanDays: 183,
      newPlanPaise: 25_06_348, // 49,990 × 183/365 = 25,063.479…
      creditPaise: 10_02_238, // 19,990 × 183/365 = 10,022.383…
      netPaise: 15_04_110,
      gstPaise: 2_70_740,
      totalPaise: 17_74_850,
      renewalPaise: 49_99_000,
    })
  })

  it('monthly to yearly: a full year from now, less the unused days of the month', () => {
    const now = new Date('2026-11-11T04:30:00Z')
    const q = charge(quotePlanChange(growthMonthly, { plan: 'growth', interval: 'year' }, now))
    expect(q).toMatchObject({
      prorated: false,
      periodStart: now,
      periodEnd: addInterval(now, 'year'),
      newPlanDays: null,
      newPlanPaise: 19_99_000,
      creditPaise: 1_33_267,
      netPaise: 18_65_733,
      gstPaise: 3_35_832,
      totalPaise: 22_01_565,
    })
  })

  it('yearly to a bigger monthly plan: the rest of the year at twelve months of the new price', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = addInterval(start, 'year')
    const now = new Date('2026-07-02T12:00:00Z')
    const q = charge(
      quotePlanChange(
        { plan: 'growth', interval: 'year', status: 'active', periodStart: start, periodEnd: end },
        { plan: 'pro', interval: 'month' },
        now,
      ),
    )
    expect(q).toMatchObject({
      prorated: true,
      periodEnd: end,
      newPlanPaise: 30_07_618, // 4,999 × 12 × 183/365
      creditPaise: 10_02_238,
      netPaise: 20_05_380,
      gstPaise: 3_60_968,
      totalPaise: 23_66_348,
      renewalPaise: 4_99_900,
    })
  })

  it('a trial, a due or paused plan, or a period already over: full price, no credit', () => {
    const now = new Date('2026-11-11T04:30:00Z')
    const full = {
      prorated: false,
      periodStart: now,
      periodEnd: addInterval(now, 'month'),
      newPlanPaise: 4_99_900,
      creditPaise: 0,
      creditPlan: null,
      netPaise: 4_99_900,
      gstPaise: 89_982,
      totalPaise: 5_89_882,
    }
    for (const current of [
      { ...growthMonthly, status: 'trialing' as const, periodStart: null, periodEnd: null },
      { ...growthMonthly, status: 'due' as const },
      { ...growthMonthly, status: 'paused' as const },
      { ...growthMonthly, periodEnd: new Date(now.getTime() - HOUR) },
    ])
      expect(
        charge(quotePlanChange(current, { plan: 'pro', interval: 'month' }, now)),
      ).toMatchObject(full)
    // A trial can pick the plan it is trying, and a lower one, at full price.
    const trial = {
      ...growthMonthly,
      status: 'trialing' as const,
      periodStart: null,
      periodEnd: null,
    }
    expect(
      charge(quotePlanChange(trial, { plan: 'growth', interval: 'month' }, now)).totalPaise,
    ).toBe(2_35_882)
    expect(
      charge(quotePlanChange(trial, { plan: 'starter', interval: 'month' }, now)).totalPaise,
    ).toBe(58_882)
  })

  it('unpaid per-order fees ride on the bill as their own amount', () => {
    const now = new Date('2026-11-11T04:30:00Z')
    const q = charge(
      quotePlanChange(growthMonthly, { plan: 'pro', interval: 'month' }, now, 12_345),
    )
    expect(q).toMatchObject({ planTotalPaise: 2_36_000, feesPaise: 12_345, totalPaise: 2_48_345 })
  })

  it('never goes below zero', () => {
    // Every real upgrade costs more per day; a hand-made period shorter than its price still floors at 0.
    const now = new Date('2026-11-11T04:30:00Z')
    for (const plan of ['growth', 'pro', 'scale'] as const)
      for (const from of ['starter', 'growth', 'pro'] as const) {
        const q = quotePlanChange(
          { ...growthMonthly, plan: from },
          { plan, interval: 'month' },
          now,
        )
        if (q.kind === 'charge') expect(q.netPaise).toBeGreaterThanOrEqual(0)
      }
  })

  it('GST on the sales order comes back out of the total exactly', () => {
    // The sales store prices include GST and extracts it: round(total × 18/118) must equal our GST.
    for (let h = 0; h < 30 * 24; h += 7) {
      const at = new Date(NOV1.getTime() + h * HOUR)
      for (const plan of ['pro', 'scale'] as const) {
        const q = charge(quotePlanChange(growthMonthly, { plan, interval: 'month' }, at))
        expect(Math.round((q.planTotalPaise * 18) / 118)).toBe(q.gstPaise)
      }
    }
  })
})

describe('paidPeriodEnd', () => {
  const start = new Date('2026-11-11T04:30:00Z')
  const prorated = {
    prorated: true,
    periodStart: start,
    periodEnd: DEC1,
    interval: 'month' as const,
  }

  it('a full bill runs one interval from when it starts', () => {
    expect(paidPeriodEnd({ ...prorated, prorated: false }, start, start)).toEqual(
      addInterval(start, 'month'),
    )
  })

  it('a prorated bill keeps its end, or gives its days from a payment after that end', () => {
    const late = new Date(DEC1.getTime() + 2 * 24 * HOUR)
    expect(paidPeriodEnd(prorated, start, start)).toEqual(DEC1)
    expect(paidPeriodEnd(prorated, late, late)).toEqual(
      new Date(late.getTime() + (DEC1.getTime() - start.getTime())),
    )
  })
})

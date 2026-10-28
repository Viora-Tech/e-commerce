/** SOURCE OF TRUTH: plan catalogue tests — WHAT: prices, limits and fees of each plan / WHY: the 2026-10-28 pricing must not drift */
import { describe, expect, it } from 'vitest'
import { nextPlanUp, PLAN_IDS, PLANS, planRank } from './plans'

describe('plans', () => {
  it('has the 2026-10-28 prices, orders, fees and visits', () => {
    expect(PLAN_IDS).toEqual(['starter', 'growth', 'pro', 'scale'])
    expect(PLANS.growth.pricePaise).toEqual({ month: 1_99_900, year: 19_99_000 })
    expect(PLANS.scale.pricePaise).toEqual({ month: 14_99_900, year: 1_49_99_000 })
    expect(PLAN_IDS.map((p) => PLANS[p].orders)).toEqual([50, 200, 500, 2000])
    expect(PLAN_IDS.map((p) => PLANS[p].feeBasisPoints)).toEqual([100, 75, 50, 0])
    expect(PLAN_IDS.map((p) => PLANS[p].visitsPerMonth)).toEqual([25_000, 100_000, 500_000, null])
    expect(PLANS.scale).toMatchObject({ staff: 25, storageGb: 100, ai: 'scale' })
  })

  it('ranks and steps up to Scale', () => {
    expect(PLAN_IDS.map(planRank)).toEqual([0, 1, 2, 3])
    expect(nextPlanUp('pro')).toBe('scale')
    expect(nextPlanUp('scale')).toBeNull()
  })
})

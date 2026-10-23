import { describe, expect, it } from 'vitest'
import {
  defaultCondition,
  evaluateSegment,
  matchesCondition,
  OPS_BY_FIELD,
  type SegmentCustomer,
  type SegmentRules,
} from './segments'

const now = new Date('2026-09-22T12:00:00.000Z')

const buyer: SegmentCustomer = {
  spentPaise: 500_000,
  orderCount: 4,
  stateCode: 'MH',
  tags: ['vip', 'wholesale'],
  lastOrderAt: new Date('2026-09-12T12:00:00.000Z'),
  acceptsMarketing: true,
  hasGstin: false,
}

const rules = (r: Partial<SegmentRules>): SegmentRules => ({
  match: 'all',
  conditions: [],
  ...r,
})

describe('matchesCondition', () => {
  it('compares spend in paise', () => {
    expect(matchesCondition(buyer, { field: 'spend', op: 'gte', value: '400000' }, now)).toBe(true)
    expect(matchesCondition(buyer, { field: 'spend', op: 'gte', value: '600000' }, now)).toBe(false)
    expect(matchesCondition(buyer, { field: 'spend', op: 'lte', value: '600000' }, now)).toBe(true)
  })

  it('compares order counts', () => {
    expect(matchesCondition(buyer, { field: 'orders', op: 'eq', value: '4' }, now)).toBe(true)
    expect(matchesCondition(buyer, { field: 'orders', op: 'gte', value: '5' }, now)).toBe(false)
  })

  it('matches the state code case insensitively', () => {
    expect(matchesCondition(buyer, { field: 'state', op: 'eq', value: 'mh' }, now)).toBe(true)
    expect(matchesCondition(buyer, { field: 'state', op: 'neq', value: 'KL' }, now)).toBe(true)
  })

  it('matches a tag by exact name, and neq when it is absent', () => {
    expect(matchesCondition(buyer, { field: 'tag', op: 'contains', value: 'VIP' }, now)).toBe(true)
    expect(matchesCondition(buyer, { field: 'tag', op: 'contains', value: 'lapsed' }, now)).toBe(
      false,
    )
    expect(matchesCondition(buyer, { field: 'tag', op: 'neq', value: 'lapsed' }, now)).toBe(true)
  })

  it('counts days since the last order', () => {
    expect(matchesCondition(buyer, { field: 'last_order_days', op: 'lte', value: '30' }, now)).toBe(
      true,
    )
    expect(matchesCondition(buyer, { field: 'last_order_days', op: 'gte', value: '30' }, now)).toBe(
      false,
    )
  })

  it('never matches a recency rule for a customer who never ordered', () => {
    const fresh = { ...buyer, lastOrderAt: null }
    expect(matchesCondition(fresh, { field: 'last_order_days', op: 'lte', value: '30' }, now)).toBe(
      false,
    )
    expect(matchesCondition(fresh, { field: 'last_order_days', op: 'gte', value: '1' }, now)).toBe(
      false,
    )
  })

  it('reads marketing consent as a boolean', () => {
    expect(matchesCondition(buyer, { field: 'marketing', op: 'eq', value: 'true' }, now)).toBe(true)
    expect(matchesCondition(buyer, { field: 'marketing', op: 'eq', value: 'false' }, now)).toBe(
      false,
    )
  })

  it('reads business (has a GSTIN) as a boolean', () => {
    const business = { ...buyer, hasGstin: true }
    const isBusiness = { field: 'business', op: 'eq', value: 'true' } as const
    const isIndividual = { field: 'business', op: 'eq', value: 'false' } as const
    expect(matchesCondition(business, isBusiness, now)).toBe(true)
    expect(matchesCondition(business, isIndividual, now)).toBe(false)
    expect(matchesCondition(buyer, isBusiness, now)).toBe(false)
    expect(matchesCondition(buyer, isIndividual, now)).toBe(true)
  })

  it('treats an unparseable number as zero rather than throwing', () => {
    expect(matchesCondition(buyer, { field: 'spend', op: 'gte', value: 'abc' }, now)).toBe(true)
    expect(matchesCondition(buyer, { field: 'orders', op: 'lte', value: '' }, now)).toBe(false)
  })
})

describe('evaluateSegment', () => {
  it('matches everyone when there are no conditions', () => {
    expect(evaluateSegment(buyer, rules({}), now)).toBe(true)
  })

  it('requires every condition in all mode', () => {
    const r = rules({
      conditions: [
        { field: 'spend', op: 'gte', value: '400000' },
        { field: 'state', op: 'eq', value: 'KL' },
      ],
    })
    expect(evaluateSegment(buyer, r, now)).toBe(false)
    expect(evaluateSegment({ ...buyer, stateCode: 'KL' }, r, now)).toBe(true)
  })

  it('requires one condition in any mode', () => {
    const r = rules({
      match: 'any',
      conditions: [
        { field: 'spend', op: 'gte', value: '900000' },
        { field: 'tag', op: 'contains', value: 'vip' },
      ],
    })
    expect(evaluateSegment(buyer, r, now)).toBe(true)
    expect(evaluateSegment({ ...buyer, tags: [] }, r, now)).toBe(false)
  })
})

describe('defaultCondition', () => {
  it('starts with an operator the field supports', () => {
    for (const field of Object.keys(OPS_BY_FIELD) as (keyof typeof OPS_BY_FIELD)[]) {
      const c = defaultCondition(field)
      expect(OPS_BY_FIELD[field]).toContain(c.op)
    }
  })

  it('defaults marketing to true so the row is usable straight away', () => {
    expect(defaultCondition('marketing')).toEqual({ field: 'marketing', op: 'eq', value: 'true' })
  })

  it('defaults business to true, so the row reads "business customers"', () => {
    expect(defaultCondition('business')).toEqual({ field: 'business', op: 'eq', value: 'true' })
  })
})

/** SOURCE OF TRUTH: route rule tests — WHAT: the `all` target, most specific rule wins (product >
 * collection / tag / type > all), same-kind rules still intersect, and `forceRoute` on the pool /
 * WHY: #1782: a Mouse product rule must beat an every-product rule instead of being cut down by it. */
import { describe, expect, it } from 'vitest'
import { delhivery, item, rule, shiprocket } from '../../testing/delivery-options-fixtures'
import { RouteRuleInputSchema } from './config'
import { routesFromAnswers } from './routes'
import { RULE_SPECIFICITY } from './config'
import { matchingRules, matchRules, ruleMatchesItem, rulePool } from './rules'

const EVERY = rule(
  'every',
  {
    name: 'Every product',
    target: { kind: 'all', values: [] },
    routes: [{ carrier: 'delhivery' }],
  },
  0,
)
const MOUSE = rule(
  'mouse',
  {
    name: 'Mouse',
    target: { kind: 'products', values: ['mouse'] },
    routes: [{ carrier: 'bluedart' }, { carrier: 'delhivery', speed: 'standard' }],
    defaultRoute: { carrier: 'bluedart', speed: 'express' },
    forceRoute: true,
  },
  1,
)
const PADS = rule(
  'pads',
  {
    name: 'Pads',
    target: { kind: 'collections', values: ['col-pads'] },
    routes: [{ carrier: 'delhivery' }],
  },
  2,
)

const routes = () => routesFromAnswers([delhivery(), shiprocket()], [], 400)

describe('rule schema', () => {
  it('accepts the all target with no values, and needs values for every other kind', () => {
    expect(
      RouteRuleInputSchema.safeParse({
        name: 'All',
        target: { kind: 'all', values: [] },
        routes: [{ carrier: 'delhivery' }],
      }).success,
    ).toBe(true)
    expect(
      RouteRuleInputSchema.safeParse({
        name: 'None',
        target: { kind: 'products', values: [] },
        routes: [{ carrier: 'delhivery' }],
      }).success,
    ).toBe(false)
  })

  it('forceRoute is off unless set', () => {
    expect(PADS.forceRoute).toBe(false)
    expect(MOUSE.forceRoute).toBe(true)
  })
})

describe('matching', () => {
  it('the all target matches every product', () => {
    expect(ruleMatchesItem(EVERY, item('anything'))).toBe(true)
    expect(RULE_SPECIFICITY.products).toBeGreaterThan(RULE_SPECIFICITY.collections)
    expect(RULE_SPECIFICITY.collections).toBeGreaterThan(RULE_SPECIFICITY.all)
  })

  it('a product rule beats an every-product rule for that product', () => {
    const m = matchRules([EVERY, MOUSE], 'std', [item('mouse')])
    expect(m.winners.map((r) => r.id)).toEqual(['mouse'])
    expect(m.outranked.map((r) => r.id)).toEqual(['every'])
    expect(matchingRules([EVERY, MOUSE], 'std', [item('mouse')]).map((r) => r.id)).toEqual([
      'mouse',
    ])
  })

  it('a collection rule beats an every-product rule, and loses to a product rule', () => {
    const pad = item('pad', ['col-pads'])
    expect(matchingRules([EVERY, PADS], 'std', [pad]).map((r) => r.id)).toEqual(['pads'])
    const both = item('mouse', ['col-pads'])
    expect(matchingRules([EVERY, PADS, MOUSE], 'std', [both]).map((r) => r.id)).toEqual(['mouse'])
  })

  it('in a mixed cart each product keeps its own winner', () => {
    const m = matchRules([EVERY, MOUSE], 'std', [item('mouse'), item('cable')])
    // The mouse follows its product rule; the cable still follows the every-product rule.
    expect(m.winners.map((r) => r.id)).toEqual(['mouse', 'every'])
    expect(m.outranked).toEqual([])
  })

  it('a turned-off rule or a rule for another option never matches', () => {
    const off = { ...MOUSE, enabled: false }
    const expressOnly = { ...PADS, optionIds: ['exp'] }
    expect(matchingRules([off, expressOnly], 'std', [item('mouse', ['col-pads'])])).toEqual([])
  })
})

describe('rule pool', () => {
  it('records outranked rules as overruled and carries the forced default', () => {
    const m = matchRules([EVERY, MOUSE], 'std', [item('mouse')])
    const pool = rulePool(m.winners, routes(), m.outranked)
    expect(pool.applied.map((r) => r.id)).toEqual(['mouse'])
    expect(pool.overruled.map((r) => r.id)).toEqual(['every'])
    expect(pool.defaultRoute).toMatchObject({ ruleId: 'mouse', force: true })
  })

  it('same-kind rules with something in common still intersect', () => {
    const glass = rule(
      'glass',
      {
        name: 'Glass',
        target: { kind: 'collections', values: ['col-glass'] },
        routes: [{ carrier: 'delhivery' }, { carrier: 'dtdc' }],
      },
      3,
    )
    const cart = [item('a', ['col-pads']), item('b', ['col-glass'])]
    const pool = rulePool(matchingRules([PADS, glass], 'std', cart), routes())
    expect(pool.applied.map((r) => r.id)).toEqual(['pads', 'glass'])
    expect(pool.defaultRoute).toBeNull()
  })

  it('nothing in common: the most specific rule wins alone', () => {
    const cart = [item('mouse'), item('pad', ['col-pads'])]
    const dtdcOnly = {
      ...PADS,
      routes: [{ carrier: 'dtdc', channel: 'any', speed: 'any' as const }],
    }
    const bluedartOnly = {
      ...MOUSE,
      routes: [{ carrier: 'bluedart', channel: 'any', speed: 'any' as const }],
    }
    const pool = rulePool(matchingRules([dtdcOnly, bluedartOnly], 'std', cart), routes())
    expect(pool.applied.map((r) => r.id)).toEqual(['mouse'])
    expect(pool.overruled.map((r) => r.id)).toEqual(['pads'])
  })
})

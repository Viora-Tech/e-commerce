import { type RouteRule, RouteRuleInputSchema } from '@commerce/core/delivery-options'
import { describe, expect, it } from 'vitest'
import { blockingRules, orderAdvice, sortBySpecificity } from './rule-order'

const rule = (id: string, kind: RouteRule['target']['kind'], carriers: string[], position: number) => ({
  ...RouteRuleInputSchema.parse({
    name: id,
    target: { kind, values: kind === 'all' ? [] : ['x'] },
    routes: carriers.map((carrier) => ({ carrier })),
  }),
  id,
  position,
})

const EVERY = rule('Every', 'all', ['delhivery'], 0)
const MICE = rule('Mice', 'collections', ['delhivery', 'bluedart'], 1)
const PAD = rule('Pad', 'products', ['delhivery'], 2)

describe('the Product rules page’s order advice', () => {
  it('says a more specific rule should sit above a broader one', () => {
    const advice = orderAdvice([EVERY, MICE, PAD]).map((a) => `${a.specific.id}>${a.broad.id}`)
    expect(advice).toEqual(['Mice>Every', 'Pad>Every', 'Pad>Mice'])
    expect(orderAdvice([PAD, MICE, EVERY])).toEqual([])
  })

  it('sorts by most specific, keeping the order within a kind', () => {
    expect(sortBySpecificity([EVERY, MICE, PAD]).map((r) => r.id)).toEqual(['Pad', 'Mice', 'Every'])
  })

  it('warns about one-courier rules, worse for all products', () => {
    expect(blockingRules([EVERY, MICE, PAD]).map((w) => [w.rule.id, w.kind])).toEqual([
      ['Every', 'allOneCourier'],
      ['Pad', 'oneCourier'],
    ])
  })
})

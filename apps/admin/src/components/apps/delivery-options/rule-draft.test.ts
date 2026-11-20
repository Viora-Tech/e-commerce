import { type RouteRule, RouteRuleInputSchema } from '@commerce/core/delivery-options'
import { describe, expect, it } from 'vitest'
import { draftOf, ruleErrors, ruleInputOf } from './rule-draft'
import { applyPreset, type RuleChip, ruleChips, seededDraft, seedOf } from './rule-presets'
import { sampleCards } from './rule-sample'

const saved = (input: Record<string, unknown>): RouteRule => ({
  ...RouteRuleInputSchema.parse({ name: 'Mice', target: { kind: 'collections', values: ['c1'] }, ...input }),
  id: 'r1',
  position: 0,
})

const chip = (carrier: string, speed: 'standard' | 'express', missing = false): RuleChip => ({
  id: `${carrier}:${speed}`,
  carrier,
  speed,
  missing,
})
const CONNECTED = [
  chip('delhivery', 'standard'),
  chip('delhivery', 'express'),
  chip('bluedart', 'express'),
  chip('amazon', 'standard'),
]

describe('the rule dialog’s form state', () => {
  it('a rule saved before rule prices opens at the normal price', () => {
    // Saved JSON without `price`, as every rule before 20 Nov 2026.
    const old = { ...saved({ routes: [{ carrier: 'delhivery' }] }) } as Partial<RouteRule>
    delete old.price
    const d = draftOf(old as RouteRule)
    expect(d.priceMode).toBe('option')
    expect(d.freeAboveOn).toBe(false)
    expect(ruleInputOf(d).price).toEqual({ mode: 'option', fixedPaise: null, freeAbovePaise: null })
  })

  it('reads speeds as chips and saves them back as the same selectors', () => {
    const rule = saved({
      routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart', speed: 'express' }],
      defaultRoute: { carrier: 'delhivery', speed: 'express' },
    })
    const d = draftOf(rule)
    expect(d.chips).toEqual(['delhivery:standard', 'delhivery:express', 'bluedart:express'])
    expect(d.preferred).toBe('delhivery:express')
    const back = ruleInputOf(d)
    expect(back.routes).toEqual([
      { carrier: 'delhivery', channel: 'any', speed: 'any' },
      { carrier: 'bluedart', channel: 'any', speed: 'express' },
    ])
    expect(back.defaultRoute).toEqual({ carrier: 'delhivery', channel: 'any', speed: 'express' })
  })

  it('round-trips a fixed price with free above', () => {
    const rule = saved({
      routes: [{ carrier: 'delhivery' }],
      price: { mode: 'fixed', fixedPaise: 9900, freeAbovePaise: 99_900 },
    })
    const d = draftOf(rule)
    expect([d.priceMode, d.fixed, d.freeAboveOn, d.freeAbove]).toEqual(['fixed', '99', true, '999'])
    expect(ruleInputOf(d).price).toEqual({ mode: 'fixed', fixedPaise: 9900, freeAbovePaise: 99_900 })
    expect(ruleErrors({ ...d, fixed: '' }).fixed).toBe(true)
  })

  it('a new rule starts with every connected courier ticked', () => {
    const d = seededDraft(draftOf(null), CONNECTED)
    expect(d.chips).toEqual(CONNECTED.map((c) => c.id))
  })

  it('keeps a saved chip no app offers now, marked', () => {
    const rows = [{ id: 'delhivery:standard', carrierKey: 'delhivery', carrier: 'Delhivery', speed: 'standard' as const, direct: true, via: [] }]
    const chips = ruleChips(rows, ['ekart:standard'])
    expect(chips.map((c) => [c.id, c.missing])).toEqual([
      ['delhivery:standard', false],
      ['ekart:standard', true],
    ])
  })
})

describe('quick starts', () => {
  const blank = draftOf(null)

  it('Free with a preferred courier: every courier, Delhivery Air first, free', () => {
    const d = applyPreset(blank, 'freePreferred', CONNECTED)
    expect(d.chips).toHaveLength(4)
    expect([d.preferred, d.forceRoute, d.priceMode]).toEqual(['delhivery:express', false, 'free'])
  })

  it('One courier only, free: Delhivery Surface alone, only this one', () => {
    const d = applyPreset(blank, 'oneFree', CONNECTED)
    expect(d.chips).toEqual(['delhivery:standard'])
    expect([d.preferred, d.forceRoute, d.priceMode]).toEqual(['delhivery:standard', true, 'free'])
  })

  it('Paid, cheapest first: every courier, no included courier, normal price', () => {
    const d = applyPreset({ ...blank, priceMode: 'free', preferred: 'x:standard' }, 'paidCheapest', CONNECTED)
    expect([d.chips.length, d.preferred, d.forceRoute, d.priceMode]).toEqual([4, null, false, 'option'])
  })

  it('a suggestion from shipping rates fills the name, products and price', () => {
    const seed = seedOf({
      profileId: 'p',
      name: 'Skates',
      target: { kind: 'products', values: ['a', 'b'] },
      titles: ['A', 'B'],
      price: { mode: 'fixed', fixedPaise: 9900, freeAbovePaise: null },
      lowestPaise: 9900,
      highestPaise: 13900,
    })
    expect(seed).toMatchObject({ name: 'Skates', kind: 'products', priceMode: 'fixed', fixed: '99', freeAboveOn: false })
  })
})

describe('the "Shoppers will see" example', () => {
  it('free by the included courier: cheaper ones free, dearer ones + the difference', () => {
    const d = applyPreset(draftOf(null), 'freePreferred', CONNECTED)
    const cards = sampleCards(d)
    expect(cards[0]).toMatchObject({ id: 'delhivery:express', pricePaise: 0, recommended: true })
    // Delhivery's other speed is hidden, as checkout hides it.
    expect(cards.map((c) => c.id)).not.toContain('delhivery:standard')
    const amazon = cards.find((c) => c.id === 'amazon:standard')
    expect(amazon?.pricePaise).toBe(0)
    const bluedart = cards.find((c) => c.id === 'bluedart:express')
    expect(bluedart?.extraPaise).toBeGreaterThan(0)
    expect(bluedart?.pricePaise).toBe(bluedart?.extraPaise)
  })

  it('only this one shows a single card', () => {
    expect(sampleCards(applyPreset(draftOf(null), 'oneFree', CONNECTED))).toHaveLength(1)
  })
})

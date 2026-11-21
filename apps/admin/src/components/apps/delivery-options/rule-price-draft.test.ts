import { type RouteRule, RouteRuleInputSchema } from '@commerce/core/delivery-options'
import { describe, expect, it } from 'vitest'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { deliveryRuleFormContent } from '@/data/delivery-rule-form'
import { draftOf, type RuleDraft, ruleCarriers, ruleErrors, ruleInputOf } from './rule-draft'
import { rulePreview } from './rule-preview'
import { sampleCards } from './rule-sample'

/** Owner, 21 Nov 2026: arm sleeves "Delhivery ₹99, Blue Dart ₹139"; switches pay packing. */
const saved = (price: Record<string, unknown>): RouteRule => ({
  ...RouteRuleInputSchema.parse({
    name: 'Arm sleeves',
    target: { kind: 'collections', values: ['c1'] },
    routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart', speed: 'express' }],
    defaultRoute: { carrier: 'delhivery', speed: 'express' },
    price,
  }),
  id: 'r1',
  position: 0,
})

const money = (paise: number) => `₹${paise / 100}`
const line = (d: RuleDraft) =>
  rulePreview(
    d,
    deliveryOptionsContent,
    deliveryPagesContent,
    deliveryRuleFormContent,
    new Map(),
    money,
  )?.text

describe('per-courier fixed prices and packing in the rule dialog', () => {
  it('round-trips a courier’s own price and a packing charge', () => {
    const price = {
      mode: 'fixed',
      fixedPaise: 9900,
      courierPaise: { bluedart: 13900 },
      packingPaise: 2000,
    }
    const d = draftOf(saved(price))
    expect(d.courierFixed).toEqual({ bluedart: '139' })
    expect(d.packing).toBe('20')
    expect(ruleInputOf(d).price).toEqual({ ...price, freeAbovePaise: null })
  })

  it('a rule without them saves the same price shape as before', () => {
    const d = draftOf(saved({ mode: 'fixed', fixedPaise: 9900 }))
    expect(d.courierFixed).toEqual({})
    expect(d.packing).toBe('')
    expect(ruleInputOf(d).price).toEqual({ mode: 'fixed', fixedPaise: 9900, freeAbovePaise: null })
  })

  it('drops blanks, couriers no longer in the rule, and per-courier prices off Fixed', () => {
    const d = draftOf(saved({ mode: 'fixed', fixedPaise: 9900 }))
    expect(ruleCarriers(d)).toEqual(['delhivery', 'bluedart'])
    const typed = { ...d, courierFixed: { delhivery: '', bluedart: '139', ekart: '50' } }
    expect(ruleInputOf(typed).price.courierPaise).toEqual({ bluedart: 13900 })
    expect(ruleInputOf({ ...typed, priceMode: 'option' }).price.courierPaise).toBeUndefined()
  })

  it('packing on the normal price and Fixed, never on Free', () => {
    const d = { ...draftOf(saved({ mode: 'option' })), packing: '20' }
    expect(ruleInputOf(d).price.packingPaise).toBe(2000)
    expect(ruleInputOf({ ...d, priceMode: 'free' }).price.packingPaise).toBeUndefined()
  })

  it('a typed price that isn’t rupees is an error; blank is fine', () => {
    const d = draftOf(saved({ mode: 'fixed', fixedPaise: 9900 }))
    expect(ruleErrors(d)).toMatchObject({ courierFixed: false, packing: false })
    expect(ruleErrors({ ...d, courierFixed: { bluedart: 'abc' } }).courierFixed).toBe(true)
    expect(ruleErrors({ ...d, packing: '-5' }).packing).toBe(true)
    expect(ruleErrors({ ...d, priceMode: 'free', packing: '-5' }).packing).toBe(false)
  })

  it('the example: a named courier shows its own price; packing is on every card', () => {
    const d = {
      ...draftOf(saved({ mode: 'fixed', fixedPaise: 9900 })),
      courierFixed: { bluedart: '139' },
      packing: '10',
    }
    const cards = sampleCards(d)
    expect(cards[0]).toMatchObject({ id: 'delhivery:express', pricePaise: 10900 })
    expect(cards.find((c) => c.id === 'bluedart:express')).toMatchObject({
      pricePaise: 14900,
      extraPaise: 0,
    })
  })

  it('the live line says the courier prices and the packing', () => {
    const d = {
      ...draftOf(saved({ mode: 'fixed', fixedPaise: 9900 })),
      courierFixed: { bluedart: '139' },
      packing: '20',
    }
    expect(line(d)).toBe(
      'Products in Arm sleeves ship for ₹99 by Delhivery Air; shoppers can still pick Blue Dart Air (Blue Dart for ₹139, plus ₹20 for packing).',
    )
  })
})

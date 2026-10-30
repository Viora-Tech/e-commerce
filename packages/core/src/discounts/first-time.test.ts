/** SOURCE OF TRUTH: "first-time buyers only" tests: the evaluator's rule, the shopper-facing rejection, the schema and the phone spellings earlier orders are looked up by */
import { describe, expect, it } from 'vitest'
import { orderPhoneForms } from './eligibility'
import { type DiscountCart, type DiscountRule, evaluateDiscount } from './evaluate'
import { DiscountInputSchema } from './schemas'

const now = new Date('2026-10-31T10:00:00Z')

const welcome: DiscountRule = {
  id: 'd1',
  title: 'WELCOME10',
  kind: 'code',
  code: 'WELCOME10',
  method: 'percent',
  value: 1000,
  minSubtotalPaise: null,
  appliesTo: 'all',
  appliesToIds: [],
  customerEligibility: 'first_time',
  eligibleIds: [],
  usageLimit: null,
  usagePerCustomer: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  status: 'active',
}

const cart: DiscountCart = {
  lines: [{ productId: '00000000-0000-4000-8000-000000000001', quantity: 1, unitPricePaise: 100_000 }],
}

describe('first-time buyers only', () => {
  it('applies to a shopper with no earlier paid order', () => {
    const r = evaluateDiscount(cart, welcome, { now, firstOrder: true })
    expect(r).toMatchObject({ ok: true, amountPaise: 10_000 })
  })

  it('is refused, with its own reason, for a shopper who ordered before', () => {
    const r = evaluateDiscount(cart, welcome, { now, firstOrder: false })
    expect(r).toMatchObject({ ok: false, reason: 'not_first_order' })
  })

  it('waits for checkout while the shopper is unknown', () => {
    expect(evaluateDiscount(cart, welcome, { now }).ok).toBe(true)
  })

  it('ignores customer and segment lists', () => {
    const r = evaluateDiscount(cart, welcome, {
      now,
      firstOrder: true,
      customer: { id: null, segmentIds: [] },
    })
    expect(r.ok).toBe(true)
  })

  it('does not change discounts for everyone', () => {
    const all = { ...welcome, customerEligibility: 'all' as const }
    expect(evaluateDiscount(cart, all, { now, firstOrder: false }).ok).toBe(true)
  })
})

describe('DiscountInputSchema first_time', () => {
  const base = { title: 'Welcome', kind: 'automatic' as const, method: 'percent' as const, value: 1000 }

  it('needs no picked ids', () => {
    const r = DiscountInputSchema.safeParse({ ...base, customerEligibility: 'first_time' })
    expect(r.success).toBe(true)
  })

  it('still needs ids for segments and customers', () => {
    expect(
      DiscountInputSchema.safeParse({ ...base, customerEligibility: 'customers' }).success,
    ).toBe(false)
  })
})

describe('orderPhoneForms', () => {
  it('tries every spelling of an Indian mobile', () => {
    expect(orderPhoneForms('98765 43210')).toEqual([
      '9876543210',
      '919876543210',
      '+919876543210',
      '+91 9876543210',
      '09876543210',
    ])
    expect(orderPhoneForms('+91 98765-43210')).toContain('9876543210')
  })

  it('keeps a number abroad in E.164 and its digits only', () => {
    expect(orderPhoneForms('+61 412 345 678')).toEqual(['+61412345678', '61412345678'])
  })

  it('finds nothing for a blank or too short number', () => {
    expect(orderPhoneForms('')).toEqual([])
    expect(orderPhoneForms(null)).toEqual([])
    expect(orderPhoneForms('123')).toEqual([])
  })
})

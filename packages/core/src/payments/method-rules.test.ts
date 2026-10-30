import { describe, expect, it } from 'vitest'
import { captureModeFor, supportsManualCapture } from './capture'
import {
  hiddenPaymentMethods,
  PaymentMethodRuleSchema,
  PaymentMethodRulesSchema,
  ruleMatches,
} from './method-rules'

const P1 = '11111111-1111-4111-8111-111111111111'

const rule = (over: Partial<Parameters<typeof PaymentMethodRuleSchema.parse>[0]> = {}) =>
  PaymentMethodRuleSchema.parse({ id: 'r1', methods: ['cod'], ...over })

const order = { orderValuePaise: 600_000, pincode: '110001', productIds: [P1] }

describe('payment method rules (#150)', () => {
  it('never fires without a condition, or when off', () => {
    expect(ruleMatches(rule(), order)).toBe(false)
    expect(ruleMatches(rule({ totalAbovePaise: 500_000, enabled: false }), order)).toBe(false)
  })

  it('hides COD above an amount and below another', () => {
    expect(ruleMatches(rule({ totalAbovePaise: 500_000 }), order)).toBe(true)
    expect(ruleMatches(rule({ totalAbovePaise: 600_000 }), order)).toBe(false)
    expect(ruleMatches(rule({ totalBelowPaise: 50_000 }), order)).toBe(false)
    expect(ruleMatches(rule({ totalBelowPaise: 700_000 }), order)).toBe(true)
  })

  it('matches PIN codes as typed with spaces or dashes, and products in the cart', () => {
    expect(ruleMatches(rule({ pincodes: ['110001'] }), { ...order, pincode: '110 001' })).toBe(true)
    expect(ruleMatches(rule({ pincodes: ['560001'] }), order)).toBe(false)
    expect(ruleMatches(rule({ productIds: [P1] }), order)).toBe(true)
    expect(ruleMatches(rule({ productIds: [P1] }), { ...order, productIds: [] })).toBe(false)
  })

  it('needs every set condition with match all, any one with match any', () => {
    const both = { totalAbovePaise: 500_000, pincodes: ['560001'] }
    expect(ruleMatches(rule({ ...both, match: 'any' }), order)).toBe(true)
    expect(ruleMatches(rule({ ...both, match: 'all' }), order)).toBe(false)
  })

  it('collects every hidden method across rules', () => {
    const rules = [
      rule({ id: 'a', methods: ['cod'], totalAbovePaise: 0 }),
      rule({ id: 'b', methods: ['manual', 'cod'], pincodes: ['110001'] }),
      rule({ id: 'c', methods: ['razorpay'], pincodes: ['999999'] }),
    ]
    expect([...hiddenPaymentMethods(rules, order)].sort()).toEqual(['cod', 'manual'])
    expect(hiddenPaymentMethods(undefined, order).size).toBe(0)
  })

  it('refuses a rule that hides nothing, a bad PIN code or too many rules', () => {
    expect(PaymentMethodRuleSchema.safeParse({ id: 'r', methods: [] }).success).toBe(false)
    expect(
      PaymentMethodRuleSchema.safeParse({ id: 'r', methods: ['cod'], pincodes: ['12'] }).success,
    ).toBe(false)
    const many = Array.from({ length: 21 }, (_, i) => ({ id: `r${i}`, methods: ['cod'] }))
    expect(PaymentMethodRulesSchema.safeParse(many).success).toBe(false)
  })
})

describe('payment capture mode (#150)', () => {
  it('is manual only where the store chose it and the gateway can', () => {
    expect(supportsManualCapture('razorpay')).toBe(true)
    expect(supportsManualCapture('cashfree')).toBe(false)
    expect(captureModeFor({}, 'razorpay')).toBe('automatic')
    expect(captureModeFor({ capture: { razorpay: 'manual' } }, 'razorpay')).toBe('manual')
    expect(captureModeFor({ capture: { cashfree: 'manual' } }, 'cashfree')).toBe('automatic')
  })
})

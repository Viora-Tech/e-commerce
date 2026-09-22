import { describe, expect, it } from 'vitest'
import {
  applyDiscount,
  bestAutomaticDiscount,
  type DiscountCart,
  type DiscountRule,
  describeDiscountValue,
  evaluateDiscount,
  normaliseCode,
} from './evaluate'

const base: DiscountRule = {
  id: 'd1',
  title: 'Launch offer',
  kind: 'code',
  code: 'LAUNCH10',
  method: 'percent',
  value: 1000,
  minSubtotalPaise: null,
  appliesTo: 'all',
  appliesToIds: [],
  usageLimit: null,
  usagePerCustomer: null,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  status: 'active',
}

const cart: DiscountCart = {
  lines: [
    { productId: 'p1', quantity: 2, unitPricePaise: 199_900 },
    { productId: 'p2', quantity: 1, unitPricePaise: 9_999 },
  ],
  shippingPaise: 9_900,
}

const now = new Date('2026-09-22T10:00:00Z')

describe('evaluateDiscount', () => {
  it('takes a percentage off the whole cart, rounded half up', () => {
    const r = evaluateDiscount(cart, base, { now })
    expect(r).toMatchObject({ ok: true, amountPaise: 40_980, freeShipping: false })
  })

  it('fixed amounts never exceed the eligible subtotal', () => {
    const r = evaluateDiscount(cart, { ...base, method: 'fixed', value: 99_999_900 }, { now })
    expect(r).toMatchObject({ ok: true, amountPaise: 409_799 })
  })

  it('free shipping takes nothing off the subtotal', () => {
    const r = evaluateDiscount(cart, { ...base, method: 'free_shipping', value: 0 }, { now })
    expect(r).toMatchObject({ ok: true, amountPaise: 0, freeShipping: true })
  })

  it('enforces the minimum subtotal', () => {
    const r = evaluateDiscount(cart, { ...base, minSubtotalPaise: 500_000 }, { now })
    expect(r).toMatchObject({ ok: false, reason: 'min_subtotal' })
  })

  it('respects the active window', () => {
    expect(
      evaluateDiscount(cart, { ...base, startsAt: new Date('2026-10-01T00:00:00Z') }, { now }),
    ).toMatchObject({ ok: false, reason: 'not_started' })
    expect(
      evaluateDiscount(cart, { ...base, endsAt: new Date('2026-09-01T00:00:00Z') }, { now }),
    ).toMatchObject({ ok: false, reason: 'expired' })
  })

  it('stops at the usage limit and the per-customer cap', () => {
    expect(evaluateDiscount(cart, { ...base, usageLimit: 5, usedCount: 5 }, { now })).toMatchObject(
      {
        ok: false,
        reason: 'usage_limit',
      },
    )
    expect(
      evaluateDiscount(cart, { ...base, usagePerCustomer: 1 }, { now, customerUses: 1 }),
    ).toMatchObject({ ok: false, reason: 'customer_limit' })
  })

  it('scopes to products and prices only the matching lines', () => {
    const scoped: DiscountRule = { ...base, appliesTo: 'products', appliesToIds: ['p2'] }
    expect(evaluateDiscount(cart, scoped, { now })).toMatchObject({ ok: true, amountPaise: 1_000 })
    expect(evaluateDiscount(cart, { ...scoped, appliesToIds: ['p9'] }, { now })).toMatchObject({
      ok: false,
      reason: 'no_eligible_items',
    })
  })

  it('rejects disabled discounts', () => {
    expect(evaluateDiscount(cart, { ...base, status: 'disabled' }, { now })).toMatchObject({
      ok: false,
      reason: 'disabled',
    })
  })
})

describe('bestAutomaticDiscount', () => {
  it('picks the largest automatic discount and ignores codes', () => {
    const r = bestAutomaticDiscount(
      cart,
      [
        { ...base, id: 'code', kind: 'code' },
        { ...base, id: 'auto5', kind: 'automatic', code: null, value: 500 },
        { ...base, id: 'auto200', kind: 'automatic', code: null, method: 'fixed', value: 20_000 },
        { ...base, id: 'ship', kind: 'automatic', code: null, method: 'free_shipping', value: 0 },
      ],
      { now },
    )
    expect(r?.discount.id).toBe('auto5')
  })

  it('returns null when nothing applies', () => {
    expect(
      bestAutomaticDiscount(cart, [{ ...base, kind: 'automatic', status: 'disabled' }]),
    ).toBeNull()
  })
})

describe('applyDiscount and helpers', () => {
  it('reduces the subtotal and zeroes shipping for free-shipping offers', () => {
    const ship = evaluateDiscount(cart, { ...base, method: 'free_shipping' }, { now })
    if (!ship.ok) throw new Error('expected ok')
    expect(applyDiscount(409_799, 9_900, ship)).toEqual({
      discountPaise: 0,
      shippingPaise: 0,
      discountedSubtotalPaise: 409_799,
    })
    const pct = evaluateDiscount(cart, base, { now })
    if (!pct.ok) throw new Error('expected ok')
    expect(applyDiscount(409_799, 9_900, pct).discountedSubtotalPaise).toBe(368_819)
  })

  it('normalises codes and describes values', () => {
    expect(normaliseCode('  launch10 ')).toBe('LAUNCH10')
    expect(describeDiscountValue({ method: 'percent', value: 1250 })).toBe('12.5% off')
    expect(describeDiscountValue({ method: 'fixed', value: 20_000 })).toBe('₹200 off')
    expect(describeDiscountValue({ method: 'free_shipping', value: 0 })).toBe('Free shipping')
  })
})

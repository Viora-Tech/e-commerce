import { describe, expect, it } from 'vitest'
import { combineDiscounts } from './combine'
import {
  applyDiscount,
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
  it('takes a percentage off the whole cart, rounded to the whole rupee (#141)', () => {
    const r = evaluateDiscount(cart, base, { now })
    expect(r).toMatchObject({ ok: true, amountPaise: 41_000, freeShipping: false })
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

describe('combineDiscounts without combinations', () => {
  const applied = (rules: DiscountRule[]) =>
    rules.map((d) => evaluateDiscount(cart, d, { now })).filter((r) => r.ok)

  it('picks the most valuable automatic discount', () => {
    const r = combineDiscounts(
      cart,
      null,
      applied([
        { ...base, id: 'auto5', kind: 'automatic', code: null, value: 500 },
        { ...base, id: 'auto200', kind: 'automatic', code: null, method: 'fixed', value: 20_000 },
        { ...base, id: 'ship', kind: 'automatic', code: null, method: 'free_shipping', value: 0 },
      ]),
      new Map(),
    )
    expect(r?.discount.id).toBe('auto5')
  })

  it('returns null when nothing applies', () => {
    expect(combineDiscounts(cart, null, [], new Map())).toBeNull()
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
    expect(applyDiscount(409_799, 9_900, pct).discountedSubtotalPaise).toBe(368_799)
  })

  it('normalises codes and describes values', () => {
    expect(normaliseCode('  launch10 ')).toBe('LAUNCH10')
    expect(describeDiscountValue({ method: 'percent', value: 1250 })).toBe('12.5% off')
    expect(describeDiscountValue({ method: 'fixed', value: 20_000 })).toBe('₹200 off')
    expect(describeDiscountValue({ method: 'free_shipping', value: 0 })).toBe('Free shipping')
  })
})

describe('a different amount for each product (per item)', () => {
  // Product X ₹1,000, product Y ₹2,500, product Z ₹500 (not in the discount).
  const perProduct: DiscountRule = {
    ...base,
    code: 'KILLTONED',
    method: 'fixed',
    value: 0,
    appliesTo: 'products',
    appliesToIds: ['x', 'y'],
    productValues: { x: 20_000, y: 30_000 },
  }
  const line = (productId: string, quantity: number, unitPricePaise: number) => ({
    productId,
    quantity,
    unitPricePaise,
  })

  it('takes each product its own fixed amount', () => {
    const r = evaluateDiscount(
      { lines: [line('x', 1, 100_000), line('y', 1, 250_000)] },
      perProduct,
      { now },
    )
    expect(r).toMatchObject({ ok: true, amountPaise: 50_000 })
  })

  it('takes the amount off every unit: 2 × X at ₹200 is ₹400', () => {
    const r = evaluateDiscount({ lines: [line('x', 2, 100_000)] }, perProduct, { now })
    expect(r).toMatchObject({ ok: true, amountPaise: 40_000 })
  })

  it('takes a percent of each unit price, rounded to the whole rupee', () => {
    const pct: DiscountRule = {
      ...perProduct,
      method: 'percent',
      productValues: { x: 1000, y: 1250 },
    }
    // X: 10% of ₹999.99 = 9,999.9 paise, so 10,000 per unit, × 2. Y: 12.5% of ₹2,500 = ₹312.50, so ₹313.
    const r = evaluateDiscount({ lines: [line('x', 2, 99_999), line('y', 1, 250_000)] }, pct, {
      now,
    })
    expect(r).toMatchObject({ ok: true, amountPaise: 2 * 10_000 + 31_300 })
  })

  it('gives nothing on products outside the map', () => {
    const r = evaluateDiscount(
      { lines: [line('x', 1, 100_000), line('z', 3, 50_000)] },
      perProduct,
      { now },
    )
    expect(r).toMatchObject({ ok: true, amountPaise: 20_000 })
  })

  it('is not applicable when no cart product has an amount', () => {
    const r = evaluateDiscount({ lines: [line('z', 1, 50_000)] }, perProduct, { now })
    expect(r).toMatchObject({ ok: false, reason: 'no_eligible_items' })
    const listed = { ...perProduct, appliesToIds: ['x', 'y', 'z'] }
    expect(evaluateDiscount({ lines: [line('z', 1, 50_000)] }, listed, { now })).toMatchObject({
      ok: false,
      reason: 'no_eligible_items',
    })
  })

  it('caps a fixed amount at the unit price', () => {
    const big = { ...perProduct, productValues: { x: 500_000, y: 30_000 } }
    const r = evaluateDiscount({ lines: [line('x', 2, 100_000), line('y', 1, 250_000)] }, big, {
      now,
    })
    expect(r).toMatchObject({ ok: true, amountPaise: 2 * 100_000 + 30_000 })
  })

  it('still honours the minimum subtotal, windows and usage limits', () => {
    const one = { lines: [line('x', 1, 100_000)] }
    expect(
      evaluateDiscount(one, { ...perProduct, minSubtotalPaise: 200_000 }, { now }),
    ).toMatchObject({ ok: false, reason: 'min_subtotal' })
    expect(
      evaluateDiscount(one, { ...perProduct, endsAt: new Date('2026-01-01') }, { now }),
    ).toMatchObject({ ok: false, reason: 'expired' })
    expect(
      evaluateDiscount(one, { ...perProduct, usageLimit: 1, usedCount: 1 }, { now }),
    ).toMatchObject({ ok: false, reason: 'usage_limit' })
  })

  it('leaves codes without a map exactly as before (fixed once per order)', () => {
    const old: DiscountRule = { ...perProduct, value: 20_000, productValues: null }
    const r = evaluateDiscount({ lines: [line('x', 2, 100_000), line('y', 1, 250_000)] }, old, {
      now,
    })
    expect(r).toMatchObject({ ok: true, amountPaise: 20_000 })
    const empty = { ...old, productValues: {} }
    expect(evaluateDiscount({ lines: [line('x', 2, 100_000)] }, empty, { now })).toMatchObject({
      ok: true,
      amountPaise: 20_000,
    })
  })

  it('ignores a map on a discount that is not product-scoped', () => {
    const all = { ...perProduct, appliesTo: 'all' as const, value: 10_000 }
    const r = evaluateDiscount({ lines: [line('x', 2, 100_000)] }, all, { now })
    expect(r).toMatchObject({ ok: true, amountPaise: 10_000 })
  })

  it('describes a per-product value', () => {
    expect(describeDiscountValue(perProduct)).toBe('₹200 to ₹300 off each item')
    expect(describeDiscountValue({ ...perProduct, productValues: { x: 20_000 } })).toBe(
      '₹200 off each item',
    )
    expect(
      describeDiscountValue({ ...perProduct, method: 'percent', productValues: { x: 1000 } }),
    ).toBe('10% off each item')
  })
})

import { describe, expect, it } from 'vitest'
import { discountsContent as copy } from '@/data/discounts'
import {
  combinationsLabel,
  type DiscountSummaryInput,
  discountListSummary,
  eligibilityLabel,
} from './discount-list-summary'

const money = (paise: number) => `₹${(paise / 100).toFixed(2)}`

const base: DiscountSummaryInput = {
  type: 'products',
  method: 'fixed',
  value: 20_000,
  appliesTo: 'products',
  appliesToCount: 18,
  productValues: null,
  combos: null,
  bxgy: null,
  minSubtotalPaise: null,
  minQuantity: null,
  shippingStateCount: 0,
  maxShippingPaise: null,
  usageLimit: null,
  usagePerCustomer: null,
}

const summary = (patch: Partial<DiscountSummaryInput>) =>
  discountListSummary({ ...base, ...patch }, copy, money)

describe('discountListSummary', () => {
  it('reads an amount off some products', () => {
    expect(summary({})).toBe('₹200 off on 18 products')
    expect(summary({ appliesToCount: 1 })).toBe('₹200 off on 1 product')
  })

  it('reads collections, every product and the whole order', () => {
    expect(summary({ appliesTo: 'collections', appliesToCount: 2 })).toBe(
      '₹200 off on 2 collections',
    )
    expect(summary({ appliesTo: 'all', method: 'percent', value: 1_000 })).toBe(
      '10% off on all products',
    )
    expect(summary({ type: 'order', appliesTo: 'all', method: 'percent', value: 1_500 })).toBe(
      '15% off on the entire order',
    )
  })

  it('reads per-product amounts as a range', () => {
    expect(summary({ productValues: { a: 20_000, b: 30_000 }, appliesToCount: 2 })).toBe(
      '₹200 to ₹300 off each item on 2 products',
    )
  })

  it('counts combos of a combo deal', () => {
    const combo = { scope: 'products' as const, items: [], method: 'price' as const, value: 1 }
    expect(summary({ type: 'combo', combos: [combo, combo, combo] })).toBe('3 combos')
    expect(summary({ type: 'combo', combos: [combo] })).toBe('1 combo')
    expect(summary({ type: 'combo', combos: null })).toBe('0 combos')
  })

  it('reads buy X get Y, free or at a discount, and its per-order cap', () => {
    const bxgy = {
      buys: {
        kind: 'quantity' as const,
        quantity: 2,
        amountPaise: 0,
        appliesTo: 'products' as const,
        ids: [],
      },
      gets: { quantity: 1, appliesTo: 'products' as const, ids: [] },
      maxUsesPerOrder: 1,
    }
    expect(summary({ type: 'bxgy', method: 'percent', value: 10_000, bxgy })).toBe(
      'Buy 2 items, get 1 free • Applies once per order',
    )
    expect(
      summary({
        type: 'bxgy',
        method: 'percent',
        value: 5_000,
        bxgy: {
          ...bxgy,
          buys: { ...bxgy.buys, kind: 'amount', amountPaise: 99_900 },
          maxUsesPerOrder: 3,
        },
      }),
    ).toBe('Spend ₹999.00, get 1 at 50% off • Up to 3 times per order')
  })

  it('reads free shipping with its states and rate cap', () => {
    const ship = { type: 'shipping' as const, method: 'free_shipping' as const, value: 0 }
    expect(summary(ship)).toBe('Free shipping to all states')
    expect(summary({ ...ship, shippingStateCount: 3, maxShippingPaise: 10_000 })).toBe(
      'Free shipping to 3 states on rates up to ₹100.00',
    )
  })

  it('adds the minimum and the limits in order', () => {
    expect(summary({ minSubtotalPaise: 99_900, usagePerCustomer: 1, usageLimit: 100 })).toBe(
      '₹200 off on 18 products • Minimum purchase of ₹999.00 • One use per customer • Limited to 100 uses',
    )
    expect(summary({ minQuantity: 3, usagePerCustomer: 2 })).toBe(
      '₹200 off on 18 products • Minimum 3 items • 2 uses per customer',
    )
  })
})

describe('eligibilityLabel', () => {
  it('names who can use the discount', () => {
    expect(eligibilityLabel({ customerEligibility: 'all', eligibleCount: 0 }, copy)).toBe(
      'All customers',
    )
    expect(eligibilityLabel({ customerEligibility: 'segments', eligibleCount: 3 }, copy)).toBe(
      '3 segments',
    )
    expect(eligibilityLabel({ customerEligibility: 'customers', eligibleCount: 1 }, copy)).toBe(
      '1 customer',
    )
  })
})

describe('combinationsLabel', () => {
  it('lists the classes it stacks with', () => {
    const none = { products: false, order: false, shipping: false }
    expect(combinationsLabel({ combinesWith: none }, copy)).toBe("Doesn't combine")
    expect(
      combinationsLabel({ combinesWith: { ...none, products: true, shipping: true } }, copy),
    ).toBe('Product, shipping discounts')
  })
})

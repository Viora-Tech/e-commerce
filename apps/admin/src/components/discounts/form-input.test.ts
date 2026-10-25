import { DiscountInputSchema } from '@commerce/core/discounts'
import { describe, expect, it } from 'vitest'
import { discountFormContent } from '@/data/discounts'
import { formErrors, toInput } from './form-input'
import { emptyForm } from './form-state'

const P = '00000000-0000-4000-8000-000000000001'
const C = '00000000-0000-4000-8000-000000000002'
const copy = discountFormContent.errors

describe('discount form to input', () => {
  it('amount off products: a collection scope saves as collections', () => {
    const f = {
      ...emptyForm('products'),
      title: 'Sale',
      code: 'SALE',
      value: '10',
      collectionIds: [C],
    }
    const input = toInput(f)
    expect(input).toMatchObject({
      type: 'products',
      appliesTo: 'collections',
      appliesToIds: [C],
      value: 1000,
    })
    expect(DiscountInputSchema.safeParse(input).success).toBe(true)
  })

  it('buy X get Y: free gets save as 100% off', () => {
    const f = {
      ...emptyForm('bxgy'),
      title: 'BOGO',
      code: 'BOGO',
      buysQuantity: '2',
      buysIds: [P],
      getsIds: [P],
      limitPerOrder: true,
      maxUsesPerOrder: '1',
    }
    expect(formErrors(f, copy)).toEqual({})
    const input = toInput(f)
    expect(input).toMatchObject({ method: 'percent', value: 10_000, appliesTo: 'all' })
    expect(input.bxgy).toMatchObject({ buys: { quantity: 2, ids: [P] }, maxUsesPerOrder: 1 })
    expect(DiscountInputSchema.safeParse(input).success).toBe(true)
  })

  it('free shipping with states, a rate cap and a minimum quantity', () => {
    const f = {
      ...emptyForm('shipping'),
      title: 'Ship',
      code: 'SHIP',
      allStates: false,
      shippingStates: ['KA'],
      excludeRates: true,
      maxShipping: '150',
      minimum: 'quantity' as const,
      minQuantity: '3',
    }
    const input = toInput(f)
    expect(input).toMatchObject({
      method: 'free_shipping',
      shippingStates: ['KA'],
      maxShippingPaise: 15_000,
      minQuantity: 3,
      minSubtotalPaise: null,
    })
    expect(DiscountInputSchema.safeParse(input).success).toBe(true)
  })

  it('asks for picks the type needs', () => {
    const f = { ...emptyForm('bxgy'), title: 'X', code: 'XX', eligibility: 'segments' as const }
    expect(Object.keys(formErrors(f, copy)).sort()).toEqual([
      'buysItems',
      'eligibility',
      'getsItems',
    ])
  })
})

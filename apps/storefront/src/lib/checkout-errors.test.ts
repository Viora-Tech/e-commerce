import { CartEmpty, PreorderLimitReached, PriceNotSet, VariantHidden } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { checkoutContent } from '@/data/checkout'
import { checkoutErrorMessage } from './checkout-errors'

describe('checkoutErrorMessage', () => {
  it('names an item hidden on the store after it went into the cart (#934)', () => {
    expect(checkoutErrorMessage(new VariantHidden('v1'), '560001')).toBe(
      checkoutContent.errors.variantHidden,
    )
    expect(checkoutErrorMessage(new PriceNotSet('v1'), '560001')).toBe(
      checkoutContent.errors.priceNotSet,
    )
  })

  it('says a full pre-order is full, not out of stock (#1539)', () => {
    expect(checkoutErrorMessage(new PreorderLimitReached('v1'), '560001')).toBe(
      checkoutContent.errors.preorderFull,
    )
  })

  it('leaves errors the shopper cannot fix to the caller', () => {
    expect(checkoutErrorMessage(new CartEmpty('c1'), '560001')).toBeNull()
    expect(checkoutErrorMessage(new Error('boom'), '560001')).toBeNull()
  })
})

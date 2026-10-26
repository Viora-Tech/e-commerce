import { verifyHandoffToken } from '@commerce/core/checkout-handoff'
import { describe, expect, it } from 'vitest'
import { checkoutHandoffTarget } from './checkout-handoff'

const SECRET = 'test-handoff-secret-0123456789'
const base = {
  storeId: 'store-1',
  cartId: 'cart-1' as string | null,
  customerId: null as string | null,
  secret: SECRET,
}

describe('checkoutHandoffTarget', () => {
  it('hands off to the branded checkout origin with a token that verifies', () => {
    const target = checkoutHandoffTarget({
      ...base,
      checkoutOrigin: 'https://checkout.waimers.com',
      storeOrigin: 'https://waimers.com',
    })
    expect(target.startsWith('https://checkout.waimers.com/c/')).toBe(true)
    const token = target.slice('https://checkout.waimers.com/c/'.length)
    expect(verifyHandoffToken(token, SECRET)).toMatchObject({
      ok: true,
      storeId: 'store-1',
      cartId: 'cart-1',
    })
  })

  it('stays same-origin when the checkout origin equals the store origin (flag off / unprovisioned)', () => {
    expect(
      checkoutHandoffTarget({
        ...base,
        checkoutOrigin: 'https://waimers.com',
        storeOrigin: 'https://waimers.com',
      }),
    ).toBe('/checkout')
  })

  it('sends an empty cart back to /cart', () => {
    expect(
      checkoutHandoffTarget({
        ...base,
        cartId: null,
        checkoutOrigin: 'https://checkout.waimers.com',
        storeOrigin: 'https://waimers.com',
      }),
    ).toBe('/cart')
  })
})

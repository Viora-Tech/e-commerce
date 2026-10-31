/** SOURCE OF TRUTH: cart limit tests — WHAT: per-product cart caps and the room left on a line / WHY: guard Settings › Checkout › Cart limit */
import { describe, expect, it } from 'vitest'
import { CartLimitSchema, cartLimitBreach, lineRoom, productCartLimit } from './cart-limit'

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'

describe('add-to-cart limit (#156)', () => {
  it('has no limit by default', () => {
    const limit = CartLimitSchema.parse({})
    expect(limit).toEqual({ maxPerProduct: 0, overrides: [] })
    expect(productCartLimit(limit, P1)).toBeNull()
    expect(lineRoom(limit, P1, 50)).toBeNull()
  })

  it('uses a product override before the store-wide limit, last repeat winning', () => {
    const limit = CartLimitSchema.parse({
      maxPerProduct: 5,
      overrides: [
        { productId: P1, max: 1 },
        { productId: P1, max: 2 },
      ],
    })
    expect(limit.overrides).toEqual([{ productId: P1, max: 2 }])
    expect(productCartLimit(limit, P1)).toBe(2)
    expect(productCartLimit(limit, P2)).toBe(5)
  })

  it('counts the other variants of the product against a line', () => {
    const limit = CartLimitSchema.parse({ maxPerProduct: 3 })
    expect(lineRoom(limit, P1, 0)).toBe(3)
    expect(lineRoom(limit, P1, 2)).toBe(1)
    expect(lineRoom(limit, P1, 5)).toBe(0)
  })

  it('finds a product over its limit across variants, never a gift card', () => {
    const limit = CartLimitSchema.parse({ maxPerProduct: 2 })
    expect(
      cartLimitBreach(limit, [
        { productId: P1, quantity: 1, title: 'Mouse' },
        { productId: P1, quantity: 2, title: 'Mouse' },
      ]),
    ).toEqual({ productId: P1, title: 'Mouse', max: 2 })
    expect(cartLimitBreach(limit, [{ productId: P2, quantity: 9, giftCard: true }])).toBeNull()
    expect(cartLimitBreach(limit, [{ productId: P2, quantity: 2 }])).toBeNull()
  })

  it('refuses limits out of range', () => {
    expect(CartLimitSchema.safeParse({ maxPerProduct: -1 }).success).toBe(false)
    expect(CartLimitSchema.safeParse({ overrides: [{ productId: P1, max: 0 }] }).success).toBe(
      false,
    )
  })
})

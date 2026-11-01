import { describe, expect, it } from 'vitest'
import { parseQrTarget, reviewPageUrl } from './qr'

describe('review QR links', () => {
  it('opens the review form on the product page', () => {
    expect(reviewPageUrl('https://shop.example/', 'veil mat')).toBe(
      'https://shop.example/products/veil%20mat?write=1#reviews',
    )
    expect(reviewPageUrl('https://shop.example', 'veil', 'tok')).toBe(
      'https://shop.example/products/veil?review=tok#reviews',
    )
  })

  it('reads the admin page target', () => {
    const id = '0190f3a2-5b6c-7d8e-9f00-112233445566'
    expect(parseQrTarget(`order-${id}`)).toEqual({ kind: 'order', id })
    expect(parseQrTarget(`product-${id.toUpperCase()}`)).toEqual({ kind: 'product', id })
    expect(parseQrTarget('customer-1')).toBeNull()
    expect(parseQrTarget(`order-${id}x`)).toBeNull()
  })
})

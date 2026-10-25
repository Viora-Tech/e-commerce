import { describe, expect, it } from 'vitest'
import { isCheckoutPath, liquidLayoutForPath } from './checkout-path'

describe('isCheckoutPath', () => {
  it('matches the checkout and the pages under it', () => {
    for (const p of ['/checkout', '/checkout/', '/checkout/thank-you/1001', '/checkout/pay/7']) {
      expect(isCheckoutPath(p)).toBe(true)
    }
  })

  it('leaves the rest of the store alone', () => {
    for (const p of ['/', '/cart', '/checkouts', '/products/checkout', '/account']) {
      expect(isCheckoutPath(p)).toBe(false)
    }
  })
})

describe('liquidLayoutForPath', () => {
  const layout = { head: '<script src="reveal.js"></script>' }

  // Hydration fix: an imported theme's scripts rewrote the checkout's headings before React
  // hydrated them (#418), so the theme's shell never wraps a checkout page.
  it('never wraps a checkout page in the imported theme', () => {
    expect(liquidLayoutForPath(layout, '/checkout')).toBeNull()
    expect(liquidLayoutForPath(layout, '/checkout/thank-you/1001')).toBeNull()
  })

  it('keeps the theme everywhere else', () => {
    expect(liquidLayoutForPath(layout, '/cart')).toBe(layout)
    expect(liquidLayoutForPath(null, '/cart')).toBeNull()
  })
})

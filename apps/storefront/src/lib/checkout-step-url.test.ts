import { describe, expect, it } from 'vitest'
import { stepHref } from './checkout-step-url'

const at = (path: string) => `https://waimers.example${path}`

describe('stepHref', () => {
  it('puts the step in the URL, Shipping as delivery', () => {
    expect(stepHref(at('/checkout'), 'contact')).toBe('/checkout?step=contact')
    expect(stepHref(at('/checkout?step=address'), 'shipping')).toBe('/checkout?step=delivery')
  })

  it('keeps every other query parameter and the hash', () => {
    expect(stepHref(at('/checkout?utm_source=wa&step=contact#top'), 'payment')).toBe(
      '/checkout?utm_source=wa&step=payment#top',
    )
    expect(stepHref(at('/ae/checkout?ref=x'), 'address')).toBe('/ae/checkout?ref=x&step=address')
  })

  it('returns null when the URL already names the step', () => {
    expect(stepHref(at('/checkout?step=delivery'), 'shipping')).toBeNull()
  })

  it('rewrites an older shipping link to delivery', () => {
    expect(stepHref(at('/checkout?step=shipping'), 'shipping')).toBe('/checkout?step=delivery')
  })
})

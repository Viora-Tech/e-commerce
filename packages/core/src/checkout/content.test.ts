import { describe, expect, it } from 'vitest'
import { applyCheckoutText, CheckoutTextSchema, checkoutTextFor } from './content'

const base = {
  placeOrder: 'Place order',
  pay: (amount: string) => `Pay ${amount}`,
  fields: { name: 'Full name', phone: 'Mobile number' },
  sections: { label: { contact: 'Contact' } },
  list: ['a', 'b'],
} as const

describe('checkout content overrides (#158)', () => {
  it('keeps known keys only, trimmed, and drops blanks', () => {
    const text = CheckoutTextSchema.parse({
      en: { 'fields.name': '  Your name ', 'fields.phone': '  ', 'not.a.key': 'x' },
    })
    expect(text).toEqual({ en: { 'fields.name': 'Your name' }, hi: {} })
  })

  it('refuses an override that is too long', () => {
    expect(CheckoutTextSchema.safeParse({ en: { summary: 'x'.repeat(201) } }).success).toBe(false)
  })

  it('falls back from Hindi to English key by key', () => {
    const text = CheckoutTextSchema.parse({
      en: { 'fields.name': 'Your name', placeOrder: 'Order now' },
      hi: { placeOrder: 'ऑर्डर करें' },
    })
    expect(checkoutTextFor(text, 'hi')).toEqual({
      'fields.name': 'Your name',
      placeOrder: 'ऑर्डर करें',
    })
    expect(checkoutTextFor(text, 'ar')).toEqual({
      'fields.name': 'Your name',
      placeOrder: 'Order now',
    })
  })

  it('writes over string leaves only and leaves the base untouched', () => {
    const out = applyCheckoutText(base, {
      'fields.name': 'Your name',
      'sections.label.contact': 'Your details',
      placeOrder: 'Order now',
    })
    expect(out.fields).toEqual({ name: 'Your name', phone: 'Mobile number' })
    expect(out.sections.label.contact).toBe('Your details')
    expect(out.placeOrder).toBe('Order now')
    expect(out.pay('₹10')).toBe('Pay ₹10')
    expect(out.list).toBe(base.list)
    expect(base.fields.name).toBe('Full name')
    // A key whose path is missing in the base changes nothing.
    expect(applyCheckoutText(base, { 'fields.company': 'Firm' })).toBe(base)
  })
})

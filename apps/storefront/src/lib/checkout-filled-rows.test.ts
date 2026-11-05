import { describe, expect, it } from 'vitest'
import { reviewRows } from '@/lib/checkout-filled-rows'
import type { CheckoutFormState } from '@/lib/checkout-form-state'
import { CHECKOUT_SECTIONS, nextSection } from '@/lib/checkout-sections'

const form = {
  name: 'Asha Rao',
  phone: '9876543210',
  email: 'asha@example.com',
  line1: '12 Lake Road',
  city: 'Sonipat',
  pincode: '131001',
} as CheckoutFormState

describe('reviewRows', () => {
  it('shows only the steps before this one', () => {
    expect(reviewRows(CHECKOUT_SECTIONS, 'contact', form, null)).toEqual([])
    expect(reviewRows(CHECKOUT_SECTIONS, 'address', form, null).map((r) => r.value)).toEqual([
      '+91 98765 43210',
    ])
  })

  it('reads a stored +91 number the same way', () => {
    const stored = { ...form, phone: '+919876543210' }
    expect(reviewRows(CHECKOUT_SECTIONS, 'address', stored, null)[0]?.value).toBe('+91 98765 43210')
  })

  it('joins the address and carries the shipping line', () => {
    const rows = reviewRows(CHECKOUT_SECTIONS, 'payment', form, 'Delhivery · Free')
    expect(rows.map((r) => r.section)).toEqual(['contact', 'address', 'shipping'])
    expect(rows[1]?.value).toBe('Asha Rao, 12 Lake Road, Sonipat 131001')
    expect(rows[2]?.value).toBe('Delhivery · Free')
  })
})

describe('nextSection', () => {
  it('walks the steps and stops at the end', () => {
    expect(nextSection('contact', CHECKOUT_SECTIONS)).toBe('address')
    expect(nextSection('payment', CHECKOUT_SECTIONS)).toBeNull()
  })
})

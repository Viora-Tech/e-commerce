import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { addressRows, contactRows } from '@/lib/checkout-filled-rows'
import type { CheckoutFormState } from '@/lib/checkout-form-state'
import CheckoutFilledRows from './checkout-filled-rows'

const form = {
  name: 'Asha Rao',
  phone: '9876543210',
  email: 'asha@example.com',
  line1: '12 Lake Road',
  city: 'Sonipat',
  pincode: '131001',
} as CheckoutFormState

const render = (done: boolean) =>
  renderToStaticMarkup(
    createElement(CheckoutFilledRows, {
      done,
      rows: contactRows(form),
      children: createElement('input', { name: 'phone' }),
    }),
  )

describe('CheckoutFilledRows', () => {
  it('reads a filled card as rows and keeps its fields in the form', () => {
    const html = render(true)
    expect(html).toContain('+91 98765 43210')
    expect(html).toContain('asha@example.com')
    expect(html).toContain('name="phone"')
    expect(html).toContain('class="hidden"')
  })

  it('shows the fields, and no rows, until the card is complete', () => {
    const html = render(false)
    expect(html).not.toContain('+91 98765 43210')
    expect(html).toContain('class="contents"')
  })

  it('leaves out an empty email and joins the address', () => {
    expect(contactRows({ ...form, email: '' })).toHaveLength(1)
    expect(addressRows(form)[0]?.value).toBe('Asha Rao, 12 Lake Road, Sonipat 131001')
  })
})

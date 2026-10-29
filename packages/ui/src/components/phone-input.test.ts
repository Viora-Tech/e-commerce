import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PhoneInput from './phone-input'

/** What the number box shows for a saved value. */
const boxValue = (value: string, defaultCountry: 'IN' | 'GB' = 'IN') => {
  const html = renderToStaticMarkup(
    createElement(PhoneInput, { value, defaultCountry, onChange: () => {} }),
  )
  const input = /<input[^>]*type="tel"[^>]*>/.exec(html)?.[0] ?? ''
  return /value="([^"]*)"/.exec(input)?.[1]
}

describe('PhoneInput', () => {
  // Same cause as #926: a saved "+919999999999" showed as "099999 99999".
  it.each(['+919999999999', '9999999999', '09999999999', '919999999999', '+91 99999-99999'])(
    'shows %s as the ten digits, with no trunk 0',
    (value) => {
      expect(boxValue(value)).toBe('99999 99999')
    },
  )

  it('keeps the 0 where the national format needs it', () => {
    expect(boxValue('+447911123456', 'GB')).toBe('07911 123456')
  })
})

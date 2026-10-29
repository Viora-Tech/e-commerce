import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import StorePhoneInput from '../src/components/store-phone-input'

/** What the number box shows for a stored, prefilled or restored value. */
const boxValue = (value: string, defaultCountry?: 'IN' | 'GB') => {
  const html = renderToStaticMarkup(
    <StorePhoneInput
      value={value}
      onChange={() => {}}
      {...(defaultCountry ? { defaultCountry } : {})}
    />,
  )
  return /<input type="tel"[^>]*value="([^"]*)"/.exec(html)?.[1]
}

describe('StorePhoneInput', () => {
  // #926: a restored "+919999999999" showed as "099999 99999".
  it.each([
    '+919999999999',
    '9999999999',
    '09999999999',
    '919999999999',
    '+91 99999 99999',
    '+91-99999-99999',
    '99999 99999',
    '099999-99999',
  ])('shows %s as the ten digits, with no trunk 0', (value) => {
    expect(boxValue(value)).toBe('99999 99999')
  })

  it('keeps an Indian landline without the trunk 0 too', () => {
    expect(boxValue('+914423456789')).toBe('44 2345 6789')
  })

  it('keeps the 0 where the national format needs it', () => {
    expect(boxValue('+447911123456', 'GB')).toBe('07911 123456')
  })

  it('leaves an empty box empty', () => {
    expect(boxValue('')).toBe('')
  })
})

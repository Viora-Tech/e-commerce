import { describe, expect, it } from 'vitest'
import { whatsappChatUrl, whatsappNumber, whatsappUrl } from './customer-contact'

describe('whatsappNumber', () => {
  it.each([
    ['9876543210', '919876543210'],
    ['98765 43210', '919876543210'],
    ['098765-43210', '919876543210'],
    ['+91 98765 43210', '919876543210'],
    ['+91 098765 43210', '919876543210'],
    ['0091 98765 43210', '919876543210'],
    ['919876543210', '919876543210'],
    ['+1 415 555 0100', '14155550100'],
  ])('%s becomes %s', (phone, digits) => {
    expect(whatsappNumber(phone)).toBe(digits)
  })

  it('is null for a missing or too-short number', () => {
    expect(whatsappNumber(null)).toBeNull()
    expect(whatsappNumber('')).toBeNull()
    expect(whatsappNumber('12345')).toBeNull()
  })
})

describe('whatsappChatUrl', () => {
  it('types the message in, encoded', () => {
    expect(whatsappChatUrl('98765 43210', 'Hi Asha, pay here: https://x.in/p?t=a&b')).toBe(
      'https://wa.me/919876543210?text=Hi%20Asha%2C%20pay%20here%3A%20https%3A%2F%2Fx.in%2Fp%3Ft%3Da%26b',
    )
  })

  it('opens an empty chat for a blank message, and nothing without a phone', () => {
    expect(whatsappChatUrl('9876543210', '  ')).toBe(whatsappUrl('9876543210'))
    expect(whatsappChatUrl(null, 'Hi')).toBeNull()
  })
})

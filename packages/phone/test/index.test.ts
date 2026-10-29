import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js/core'
import { describe, expect, it } from 'vitest'
import { phoneInputMetadata } from '../src'

const national = (e164: string) =>
  parsePhoneNumberFromString(e164, phoneInputMetadata)?.formatNational()

describe('phoneInputMetadata', () => {
  it('writes Indian numbers without the optional trunk 0', () => {
    expect(national('+919999999999')).toBe('99999 99999')
    expect(national('+919876543210')).toBe('98765 43210')
    expect(national('+914423456789')).toBe('44 2345 6789')
  })

  it('keeps the 0 where the national format needs it', () => {
    expect(national('+447911123456')).toBe('07911 123456')
    expect(national('+33612345678')).toBe('06 12 34 56 78')
    expect(national('+12015550123')).toBe('(201) 555-0123')
  })

  it('still reads a typed 0 as the trunk prefix', () => {
    const typed = new AsYouType('IN', phoneInputMetadata)
    typed.input('09876543210')
    expect(typed.getNumber()?.number).toBe('+919876543210')
  })

  it('keeps every number valid', () => {
    expect(parsePhoneNumberFromString('+919999999999', phoneInputMetadata)?.isValid()).toBe(true)
  })
})

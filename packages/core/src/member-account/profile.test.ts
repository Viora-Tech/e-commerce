/** SOURCE OF TRUTH: member profile tests — WHAT: phone normalisation and the profile schema / WHY: the API and the admin form both lean on these rules */
import { describe, expect, it } from 'vitest'
import { MemberProfileInputSchema, normaliseMemberPhone } from './profile'

describe('normaliseMemberPhone', () => {
  it('writes Indian mobiles as +91 E.164 however they are typed', () => {
    for (const raw of ['98046 82471', '098046 82471', '+91 98046 82471', '919804682471']) {
      expect(normaliseMemberPhone(raw)).toBe('+919804682471')
    }
  })

  it('keeps another country written with a plus', () => {
    expect(normaliseMemberPhone('+44 20 7946 0958')).toBe('+442079460958')
  })

  it('treats an empty field as no phone', () => {
    expect(normaliseMemberPhone('   ')).toBe('')
  })

  it('refuses numbers that cannot be a mobile', () => {
    for (const raw of ['12345', '5804682471', '+91 12345 67890', 'call me', '+0123456789']) {
      expect(normaliseMemberPhone(raw)).toBeNull()
    }
  })
})

describe('MemberProfileInputSchema', () => {
  it('trims the name and stores the phone as E.164 or null', () => {
    expect(MemberProfileInputSchema.parse({ name: '  Asha  ', phone: '98046 82471' })).toEqual({
      name: 'Asha',
      phone: '+919804682471',
    })
    expect(MemberProfileInputSchema.parse({ name: 'Asha', phone: '' })).toEqual({
      name: 'Asha',
      phone: null,
    })
  })

  it('refuses an empty name and a bad phone', () => {
    expect(MemberProfileInputSchema.safeParse({ name: ' ', phone: '' }).success).toBe(false)
    expect(MemberProfileInputSchema.safeParse({ name: 'Asha', phone: '123' }).success).toBe(false)
  })
})

/** SOURCE OF TRUTH: Meta hashing tests — WHAT: email, Indian phone, Hindi and accented names, city, state code and PIN normalisation before SHA-256 / WHY: a value normalised differently from Meta never matches, and raw values must never be sent */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  hashUserData,
  normaliseCity,
  normaliseEmail,
  normaliseMetaPhone,
  normaliseName,
  normalisePin,
  normaliseState,
  sha256,
  splitName,
} from './hash'

const h = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex')

describe('normalisers', () => {
  it('email: trimmed and lowercased; junk dropped', () => {
    expect(normaliseEmail('  Asha.Rao@Example.COM ')).toBe('asha.rao@example.com')
    expect(normaliseEmail('not an email')).toBeNull()
    expect(normaliseEmail(null)).toBeNull()
  })

  it('phone: Indian rules (10 digits get 91, leading 0 dropped, +91 kept as digits)', () => {
    expect(normaliseMetaPhone('98765 43210')).toBe('919876543210')
    expect(normaliseMetaPhone('09876543210')).toBe('919876543210')
    expect(normaliseMetaPhone('+91 98765-43210')).toBe('919876543210')
    expect(normaliseMetaPhone('(+44) 20 7946 0958')).toBe('442079460958')
    expect(normaliseMetaPhone('12345')).toBeNull()
  })

  it('names: lowercase, punctuation removed, Hindi and accents kept', () => {
    expect(normaliseName("  D'Souza ")).toBe('dsouza')
    expect(normaliseName('Mary-Ann')).toBe('maryann')
    expect(normaliseName('राहुल')).toBe('राहुल')
    expect(normaliseName('Rāhul')).toBe('rāhul')
    expect(normaliseName(' . ')).toBeNull()
  })

  it('city has no spaces; state is the two-letter code; PIN is six digits', () => {
    expect(normaliseCity('Navi Mumbai')).toBe('navimumbai')
    expect(normaliseState('MH')).toBe('mh')
    expect(normaliseState('Karnataka')).toBe('ka')
    expect(normaliseState('Atlantis')).toBeNull()
    expect(normalisePin('400 001')).toBe('400001')
    expect(normalisePin('040001')).toBeNull()
    expect(normalisePin('12345')).toBeNull()
  })

  it('splits a full name into first and last', () => {
    expect(splitName('Asha K. Rao')).toEqual({ first: 'Asha', last: 'Rao' })
    expect(splitName('Asha')).toEqual({ first: 'Asha', last: null })
    expect(splitName('  ')).toEqual({ first: null, last: null })
  })
})

describe('hashUserData', () => {
  it('hashes each known field with SHA-256 and always sends country in', () => {
    const out = hashUserData({
      email: 'Asha@Example.com',
      phone: '9876543210',
      name: 'Asha Rao',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      externalId: 'cust-1',
    })
    expect(out).toEqual({
      em: [h('asha@example.com')],
      ph: [h('919876543210')],
      fn: [h('asha')],
      ln: [h('rao')],
      ct: [h('pune')],
      st: [h('mh')],
      zp: [h('411001')],
      country: [h('in')],
      external_id: [h('cust-1')],
    })
  })

  it('leaves out what it does not know and never carries a raw value', () => {
    const out = hashUserData({ email: 'x@y.in' })
    expect(Object.keys(out).sort()).toEqual(['country', 'em'])
    expect(JSON.stringify(out)).not.toContain('x@y.in')
  })

  it('sha256 is lowercase hex', () => {
    expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})

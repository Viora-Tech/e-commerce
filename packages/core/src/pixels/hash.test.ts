/** SOURCE OF TRUTH: Meta hashing tests — WHAT: email, Indian phone, Hindi and accented names, city, state code and PIN normalisation before SHA-256 / WHY: a value normalised differently from Meta never matches, and raw values must never be sent */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { hashMatchValues, hashUserData, sha256 } from './hash'
import {
  browserMatchData,
  normaliseCity,
  normaliseCountry,
  normaliseCustomerFacts,
  normaliseEmail,
  normaliseMetaPhone,
  normaliseName,
  normalisePin,
  normaliseState,
  splitName,
} from './match'

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

  it('an address abroad carries its own country and no Indian state or PIN', () => {
    const out = hashUserData({ email: 'a@b.ae', state: 'MH', pincode: '411001', country: 'AE' })
    expect(out).toEqual({ em: [h('a@b.ae')], country: [h('ae')] })
  })

  it('sha256 is lowercase hex', () => {
    expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('normaliseCustomerFacts (shared by the browser pixel and the server)', () => {
  it('normalises every field Meta matches on, country lowercase', () => {
    expect(
      normaliseCustomerFacts({
        email: ' Asha@Example.com ',
        phone: '+91 98765 43210',
        name: 'Asha K. Rao',
        city: 'Navi Mumbai',
        state: 'MH',
        pincode: '400 703',
        country: 'IN',
        externalId: 'cust-1',
      }),
    ).toEqual({
      em: 'asha@example.com',
      ph: '919876543210',
      fn: 'asha',
      ln: 'rao',
      ct: 'navimumbai',
      st: 'mh',
      zp: '400703',
      country: 'in',
      external_id: 'cust-1',
    })
    expect(normaliseCountry(' ae ')).toBe('ae')
    expect(normaliseCountry('India')).toBeNull()
  })

  it('hashMatchValues hashes the same normalised values the server sends', () => {
    const facts = { email: 'Asha@Example.com', phone: '9876543210' }
    const browser = hashMatchValues(facts)
    const server = hashUserData(facts)
    expect(browser.em).toBe(h('asha@example.com'))
    expect(browser.ph).toBe(h('919876543210'))
    expect(server.em?.[0]).toBe(browser.em)
    expect(server.ph?.[0]).toBe(browser.ph)
  })
})

describe('browserMatchData', () => {
  it('keeps only known keys with SHA-256 hex values', () => {
    const em = h('a@b.in')
    expect(browserMatchData({ em, ph: '919876543210', other: em, country: h('in') })).toEqual({
      em,
      country: h('in'),
    })
  })

  it('refuses plain values, junk and a lone default country', () => {
    expect(browserMatchData({ em: 'a@b.in' })).toBeNull()
    expect(browserMatchData({ country: h('in') })).toBeNull()
    expect(browserMatchData(null)).toBeNull()
    expect(browserMatchData('x')).toBeNull()
  })
})

/** SOURCE OF TRUTH: onboarding answers tests — starter collections per kind of shop and the answers schema */
import { describe, expect, it } from 'vitest'
import { BusinessProfileSchema, SELLS_WHAT, starterCollections } from './business-profile'
import { WaitlistEntrySchema } from './waitlist'

describe('starterCollections', () => {
  it('gives every kind of shop the common collections, with unique titles and tags', () => {
    for (const sells of SELLS_WHAT) {
      const list = starterCollections(sells)
      expect(list.map((c) => c.title)).toEqual(
        expect.arrayContaining(['New arrivals', 'Best sellers']),
      )
      expect(new Set(list.map((c) => c.title)).size).toBe(list.length)
      expect(new Set(list.map((c) => c.tag)).size).toBe(list.length)
      for (const c of list) expect(c.tag).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('starts "something else" with only the common collections', () => {
    expect(starterCollections('other')).toHaveLength(2)
  })
})

describe('BusinessProfileSchema', () => {
  it('defaults to India and upper-cases the country', () => {
    expect(BusinessProfileSchema.parse({ sells: 'food', sellsOn: 'none' })).toEqual({
      sells: 'food',
      sellsOn: 'none',
      country: 'IN',
      state: '',
    })
    expect(
      BusinessProfileSchema.parse({ sells: 'food', sellsOn: 'none', country: 'ae' }).country,
    ).toBe('AE')
  })

  it('refuses answers the flow never offers', () => {
    expect(BusinessProfileSchema.safeParse({ sells: 'cars', sellsOn: 'none' }).success).toBe(false)
    expect(BusinessProfileSchema.safeParse({ sells: 'food', sellsOn: 'etsy' }).success).toBe(false)
  })
})

describe('WaitlistEntrySchema', () => {
  it('normalises the email and accepts Indian phone formats', () => {
    const entry = WaitlistEntrySchema.parse({
      email: ' Asha@Example.COM ',
      phone: '+91 98765 43210',
      sells: 'Handloom sarees',
    })
    expect(entry.email).toBe('asha@example.com')
  })

  it('refuses a bad email or phone', () => {
    const base = { email: 'a@example.com', phone: '9876543210', sells: 'Tea' }
    expect(WaitlistEntrySchema.safeParse({ ...base, email: 'nope' }).success).toBe(false)
    expect(WaitlistEntrySchema.safeParse({ ...base, phone: '12' }).success).toBe(false)
  })
})

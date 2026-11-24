/** SOURCE OF TRUTH: loyalty points rules tests — WHAT: points for an amount, the expiry date a year on, birthdays (29 Feb included) and the settings defaults / WHY: these pure rules decide every point, so they are checked without a database */
import { describe, expect, it } from 'vitest'
import {
  birthdaysOn,
  normaliseBirthday,
  parseLoyaltySettings,
  pointsExpiryAt,
  pointsForPaise,
} from './settings'

describe('loyalty rules', () => {
  it('gives whole points per ₹100, never a part', () => {
    expect(pointsForPaise(250_000, 1)).toBe(25)
    expect(pointsForPaise(9_999, 1)).toBe(0)
    expect(pointsForPaise(250_000, 2)).toBe(50)
    expect(pointsForPaise(250_000, 0)).toBe(0)
    expect(pointsForPaise(-100, 1)).toBe(0)
  })

  it('expires points the same moment months later, or never', () => {
    expect(pointsExpiryAt(new Date('2026-11-23T06:00:00Z'), 12)?.toISOString()).toBe(
      '2027-11-23T06:00:00.000Z',
    )
    expect(pointsExpiryAt(new Date('2026-01-31T06:00:00Z'), 1)?.toISOString()).toBe(
      '2026-02-28T06:00:00.000Z',
    )
    expect(pointsExpiryAt(new Date(), 0)).toBeNull()
  })

  it('keeps a birthday as MM-DD and celebrates 29 Feb on 28 Feb in other years', () => {
    expect(normaliseBirthday('1995-03-12')).toBe('03-12')
    expect(normaliseBirthday('02-29')).toBe('02-29')
    expect(normaliseBirthday('02-30')).toBeNull()
    expect(normaliseBirthday('13-01')).toBeNull()
    expect(birthdaysOn('2027-02-28')).toEqual(['02-28', '02-29'])
    expect(birthdaysOn('2028-02-28')).toEqual(['02-28'])
  })

  it('uses the owner’s defaults when nothing is saved', () => {
    expect(parseLoyaltySettings(undefined)).toMatchObject({
      pointsPer100: 1,
      expiryMonths: 12,
      reviewPoints: 25,
      birthdayPoints: 100,
      reminderDays: 14,
    })
  })

  it('reads a v1 row with the v2 defaults that keep v1 behaviour', () => {
    const s = parseLoyaltySettings({
      pointsPer100: 2,
      expiryMonths: 6,
      reviewPoints: 10,
      birthdayPoints: 50,
      reminderDays: 7,
    })
    expect(s).toMatchObject({
      pointsPer100: 2,
      pointsAsStoreCredit: true,
      pointsNameSingular: 'point',
      pointsNamePlural: 'points',
      excludeTags: [],
      programStatus: 'live',
      includeShipping: false,
      includeTaxes: true,
      tierBasis: 'points',
      tierWindow: 'lifetime',
    })
    expect(s.referrals.enabled).toBe(false)
  })
})

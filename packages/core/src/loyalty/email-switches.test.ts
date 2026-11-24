import { describe, expect, it } from 'vitest'
import { defaultLoyaltySettings, loyaltyEmailKey, loyaltyEmailOn } from './settings'

describe('loyalty email switches', () => {
  it('keys the two expiry emails by their reminder day', () => {
    expect(loyaltyEmailKey('points_expiring', { days: 7 })).toBe('points_expiring:7')
    expect(loyaltyEmailKey('loyalty_reward_expiring', { days: 30 })).toBe(
      'loyalty_reward_expiring:30',
    )
    expect(loyaltyEmailKey('loyalty_points_earned', { days: 3 })).toBe('loyalty_points_earned')
    expect(loyaltyEmailKey('points_expiring', null)).toBe('points_expiring')
  })

  it('sends everything until switched off', () => {
    const s = defaultLoyaltySettings
    expect(loyaltyEmailOn(s, 'loyalty_birthday')).toBe(true)
    expect(loyaltyEmailOn({ ...s, emailsOff: ['loyalty_birthday'] }, 'loyalty_birthday')).toBe(
      false,
    )
  })

  it('keeps points expiring off while reminder days is 0', () => {
    const s = { ...defaultLoyaltySettings, reminderDays: 0 }
    expect(loyaltyEmailOn(s, 'points_expiring:30')).toBe(false)
    expect(loyaltyEmailOn(s, 'loyalty_tier_unlocked')).toBe(true)
  })
})

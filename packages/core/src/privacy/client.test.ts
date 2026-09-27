/** SOURCE OF TRUTH: customer privacy rule tests — privacy and account settings defaults, data request due dates and statuses, the marketing consent gate, sign-in method fallbacks and safe CSV cells */
import { describe, expect, it } from 'vitest'
import {
  CustomerAccountSettingsSchema,
  parseCustomerAccountSettings,
  unavailableLoginMethods,
  usableLoginMethods,
} from '../customer-accounts/client'
import {
  CustomerPrivacySettingsSchema,
  daysUntilDue,
  hasMarketingConsent,
  nextStatuses,
  parseCustomerPrivacySettings,
  requestDueAt,
  requestUrgency,
} from './client'
import { csvCell } from './export'

const NOW = new Date('2026-09-27T10:00:00Z')
const flags = {
  acceptsMarketing: true,
  acceptsWhatsapp: false,
  acceptsSms: false,
  unsubscribedAt: null,
}

describe('customer privacy settings', () => {
  it('defaults to a 30 day window and banner version 1', () => {
    expect(parseCustomerPrivacySettings(null)).toEqual({
      bannerMessage: '',
      bannerVersion: 1,
      requestDueDays: 30,
    })
  })

  it('keeps a banner message set in Online Store preferences before this page existed', () => {
    const legacy = { privacy: { bannerEnabled: true, message: 'We use cookies.' } }
    expect(parseCustomerPrivacySettings(legacy).bannerMessage).toBe('We use cookies.')
    const saved = { ...legacy, customerPrivacy: { bannerMessage: '' } }
    expect(parseCustomerPrivacySettings(saved).bannerMessage).toBe('')
  })

  it('keeps the response window between 7 and 90 days', () => {
    expect(CustomerPrivacySettingsSchema.safeParse({ requestDueDays: 5 }).success).toBe(false)
    expect(CustomerPrivacySettingsSchema.safeParse({ requestDueDays: 91 }).success).toBe(false)
    expect(parseCustomerPrivacySettings({ customerPrivacy: { requestDueDays: 1000 } })).toEqual(
      parseCustomerPrivacySettings(null),
    )
  })
})

describe('data request rules', () => {
  it('sets the due date from the window and reads urgency from it', () => {
    const due = requestDueAt(NOW, 30)
    expect(due.toISOString()).toBe('2026-10-27T10:00:00.000Z')
    expect(daysUntilDue(due, NOW)).toBe(30)
    expect(requestUrgency({ status: 'open', dueAt: due }, NOW)).toBe('on_track')
    expect(requestUrgency({ status: 'open', dueAt: requestDueAt(NOW, 3) }, NOW)).toBe('due_soon')
    expect(requestUrgency({ status: 'in_progress', dueAt: requestDueAt(NOW, -1) }, NOW)).toBe(
      'overdue',
    )
    expect(requestUrgency({ status: 'completed', dueAt: requestDueAt(NOW, -1) }, NOW)).toBe(
      'closed',
    )
  })

  it('never reopens a closed request', () => {
    expect(nextStatuses('open')).toEqual(['in_progress', 'completed', 'rejected'])
    expect(nextStatuses('completed')).toEqual([])
    expect(nextStatuses('rejected')).toEqual([])
  })
})

describe('marketing consent gate', () => {
  it('needs an explicit yes on that channel', () => {
    expect(hasMarketingConsent(flags, 'email')).toBe(true)
    expect(hasMarketingConsent(flags, 'whatsapp')).toBe(false)
    expect(hasMarketingConsent(flags, 'sms')).toBe(false)
    expect(hasMarketingConsent(null, 'email')).toBe(false)
    expect(hasMarketingConsent(undefined, 'email')).toBe(false)
  })

  it('turns everything off after an unsubscribe or an erasure', () => {
    expect(hasMarketingConsent({ ...flags, unsubscribedAt: NOW }, 'email')).toBe(false)
    expect(hasMarketingConsent({ ...flags, anonymisedAt: NOW }, 'email')).toBe(false)
  })
})

describe('customer account settings', () => {
  it('defaults to guest checkout with email codes', () => {
    expect(parseCustomerAccountSettings(undefined)).toEqual({
      checkout: 'guest',
      loginMethods: ['email'],
    })
  })

  it('needs at least one method and keeps them in form order', () => {
    expect(CustomerAccountSettingsSchema.safeParse({ loginMethods: [] }).success).toBe(false)
    expect(
      CustomerAccountSettingsSchema.parse({ loginMethods: ['whatsapp', 'email', 'whatsapp'] })
        .loginMethods,
    ).toEqual(['email', 'whatsapp'])
  })

  it('offers only what the store can send, and falls back to email', () => {
    const chosen = { loginMethods: ['sms', 'whatsapp'] as const }
    const settings = { loginMethods: [...chosen.loginMethods] }
    expect(usableLoginMethods(settings, ['email', 'whatsapp'])).toEqual(['whatsapp'])
    expect(usableLoginMethods(settings, ['email'])).toEqual(['email'])
    expect(usableLoginMethods(settings, [])).toEqual([])
    expect(unavailableLoginMethods(settings, ['email', 'whatsapp'])).toEqual(['sms'])
  })
})

describe('export CSV', () => {
  it('quotes what needs quoting and defuses spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+91 98765')).toBe("'+91 98765")
    expect(csvCell(null)).toBe('')
    expect(csvCell(true)).toBe('true')
  })
})

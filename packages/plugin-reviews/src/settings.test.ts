import { describe, expect, it } from 'vitest'
import { parseReviewsSettings, requestContact } from './settings'

describe('requestContact', () => {
  const both = { email: ' Asha@Example.com ', phone: '+91 98765-43210' }

  it('picks the email, the phone or both by the channel', () => {
    expect(requestContact('email', both)).toEqual({ email: 'asha@example.com', phone: null })
    expect(requestContact('whatsapp', both)).toEqual({ email: null, phone: '+919876543210' })
    expect(requestContact('both', both)).toEqual({
      email: 'asha@example.com',
      phone: '+919876543210',
    })
  })

  it('is null when the channel has nobody to reach', () => {
    expect(requestContact('whatsapp', { email: 'a@b.c', phone: null })).toBeNull()
    expect(requestContact('email', { email: '  ', phone: '98765' })).toBeNull()
    expect(requestContact('both', {})).toBeNull()
  })

  it('reads older saved settings as email requests', () => {
    const s = parseReviewsSettings({ requestEmail: { enabled: true, daysAfterDelivery: 3 } })
    expect(s.requestEmail.channel).toBe('email')
    expect(s.requestEmail.daysAfterDelivery).toBe(3)
  })
})

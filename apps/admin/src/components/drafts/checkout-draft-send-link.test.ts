import { describe, expect, it } from 'vitest'
import { linkTooSoon } from './checkout-draft-send-link'

const NOW = new Date('2026-11-12T10:00:00Z')
const tooSoon = (data: unknown) => ({ code: 'TOO_MANY_REQUESTS', data })

describe('linkTooSoon', () => {
  it('reads the channel and rounds the minutes left up', () => {
    expect(linkTooSoon(tooSoon({ channel: 'email', nextAt: '2026-11-12T10:06:30Z' }), NOW)).toEqual(
      { channel: 'email', minutes: 7 },
    )
    expect(
      linkTooSoon(tooSoon({ channel: 'whatsapp', nextAt: '2026-11-12T10:10:00Z' }), NOW),
    ).toEqual({ channel: 'whatsapp', minutes: 10 })
  })

  it('never says 0 minutes, even when the time has just passed or is unreadable', () => {
    expect(linkTooSoon(tooSoon({ channel: 'email', nextAt: '2026-11-12T09:59:00Z' }), NOW)).toEqual(
      { channel: 'email', minutes: 1 },
    )
    expect(linkTooSoon(tooSoon({ channel: 'email', nextAt: 'soon' }), NOW)).toEqual({
      channel: 'email',
      minutes: 1,
    })
  })

  it('is null for any other error', () => {
    expect(linkTooSoon(new Error('boom'), NOW)).toBeNull()
    expect(linkTooSoon(null, NOW)).toBeNull()
    expect(linkTooSoon({ code: 'BAD_REQUEST', data: { channel: 'email' } }, NOW)).toBeNull()
    expect(linkTooSoon(tooSoon({ channel: 'sms' }), NOW)).toBeNull()
  })
})

/** SOURCE OF TRUTH: Inbox pure rules tests — WHAT: settings parsing, availability in the store's zone, access, spam, previews, shortcuts, hashing, rate-limit keys, word lists matching the schema / WHY: these decide who reads a thread and when a shop shows as online */
import {
  INBOX_BLOCK_KINDS,
  INBOX_BLOCKED_REASONS,
  INBOX_MESSAGE_KINDS,
  INBOX_SENDERS,
  INBOX_STATUSES,
} from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { createMemoryRateLimitStore } from '../rate-limit/memory-store'
import {
  BLOCK_KINDS,
  BLOCKED_REASONS,
  CONVERSATION_STATUSES,
  MESSAGE_KINDS,
  MESSAGE_SENDERS,
} from './constants'
import { hashChatToken, inboxHash, newChatToken } from './identity'
import { checkInboxLimits, inboxLimitKey, shopperMessageChecks } from './limits'
import {
  canShopperAccess,
  isFirstMessageSpam,
  linkCount,
  normaliseShortcut,
  previewOf,
} from './rules'
import {
  contactRequired,
  DEFAULT_INBOX_SETTINGS,
  isInboxAvailable,
  parseInboxSettings,
  zonedWeekMinute,
} from './settings'

describe('inbox word lists', () => {
  it('match the schema checks', () => {
    expect([...CONVERSATION_STATUSES]).toEqual([...INBOX_STATUSES])
    expect([...BLOCKED_REASONS]).toEqual([...INBOX_BLOCKED_REASONS])
    expect([...MESSAGE_SENDERS]).toEqual([...INBOX_SENDERS])
    expect([...MESSAGE_KINDS]).toEqual([...INBOX_MESSAGE_KINDS])
    expect([...BLOCK_KINDS]).toEqual([...INBOX_BLOCK_KINDS])
  })
})

describe('inbox settings', () => {
  it('defaults: guests may chat, always available, 10 minute fallback, 24 months', () => {
    expect(parseInboxSettings(undefined)).toEqual(DEFAULT_INBOX_SETTINGS)
    expect(DEFAULT_INBOX_SETTINGS).toMatchObject({
      requireSignIn: false,
      availability: 'always',
      contactCapture: 'optional',
      emailFallbackMinutes: 10,
      retentionMonths: 24,
    })
  })

  it('keeps the good fields of a half-broken blob', () => {
    const s = parseInboxSettings({ greeting: 'Namaste!', availability: 'sometimes', sound: false })
    expect(s.greeting).toBe('Namaste!')
    expect(s.availability).toBe('always')
    expect(s.sound).toBe(false)
  })

  it('reads the weekday and time in the store zone', () => {
    // 2026-10-24 is a Saturday; 20:00 UTC is 01:30 Sunday in Kolkata.
    expect(zonedWeekMinute(new Date('2026-10-24T20:00:00Z'), 'Asia/Kolkata')).toEqual({
      day: 0,
      minute: 90,
    })
  })

  it('is online inside the hours in the store zone only', () => {
    const hours = { ...DEFAULT_INBOX_SETTINGS, availability: 'hours' as const }
    // Saturday 11:00 IST = 05:30 UTC: open.
    expect(isInboxAvailable(hours, 'Asia/Kolkata', new Date('2026-10-24T05:30:00Z'))).toBe(true)
    // Saturday 20:00 IST: closed (10 to 7).
    expect(isInboxAvailable(hours, 'Asia/Kolkata', new Date('2026-10-24T14:30:00Z'))).toBe(false)
    // Sunday noon IST: closed all day.
    expect(isInboxAvailable(hours, 'Asia/Kolkata', new Date('2026-10-25T06:30:00Z'))).toBe(false)
    expect(isInboxAvailable({ ...hours, availability: 'offline' }, 'Asia/Kolkata')).toBe(false)
    expect(isInboxAvailable({ ...hours, availability: 'always' }, 'Asia/Kolkata')).toBe(true)
  })

  it('handles hours that run past midnight', () => {
    const late = {
      availability: 'hours' as const,
      hours: [{ day: 6, open: true, from: '20:00', to: '02:00' }],
    }
    // Sunday 01:30 IST belongs to Saturday's late shift.
    expect(isInboxAvailable(late, 'Asia/Kolkata', new Date('2026-10-24T20:00:00Z'))).toBe(true)
    // Sunday 03:00 IST does not.
    expect(isInboxAvailable(late, 'Asia/Kolkata', new Date('2026-10-24T21:30:00Z'))).toBe(false)
  })

  it('asks for contact details only when away and set to', () => {
    expect(contactRequired({ contactCapture: 'required_when_away' }, false)).toBe(true)
    expect(contactRequired({ contactCapture: 'required_when_away' }, true)).toBe(false)
    expect(contactRequired({ contactCapture: 'optional' }, false)).toBe(false)
  })
})

describe('conversation access', () => {
  const guest = { customerId: null, visitorKeyHash: 'v1' }
  it('a guest thread opens with its own cookie only', () => {
    expect(canShopperAccess(guest, { customerId: null, visitorKeyHash: 'v1' })).toBe(true)
    expect(canShopperAccess(guest, { customerId: null, visitorKeyHash: 'v2' })).toBe(false)
    expect(canShopperAccess(guest, { customerId: null, visitorKeyHash: null })).toBe(false)
    expect(
      canShopperAccess(
        { customerId: null, visitorKeyHash: null },
        { customerId: null, visitorKeyHash: null },
      ),
    ).toBe(false)
  })
  it('a customer thread is the customer’s alone, even on the browser that started it', () => {
    const owned = { customerId: 'c1', visitorKeyHash: 'v1' }
    expect(canShopperAccess(owned, { customerId: 'c1', visitorKeyHash: null })).toBe(true)
    expect(canShopperAccess(owned, { customerId: null, visitorKeyHash: 'v1' })).toBe(false)
    expect(canShopperAccess(owned, { customerId: 'c2', visitorKeyHash: 'v1' })).toBe(false)
  })
})

describe('spam and text rules', () => {
  it('more than two links, or the third same text from one IP, is spam', () => {
    expect(linkCount('see https://a.co and www.b.co')).toBe(2)
    expect(isFirstMessageSpam('see https://a.co and www.b.co', 0)).toBe(false)
    expect(isFirstMessageSpam('http://a.co http://b.co http://c.co', 0)).toBe(true)
    expect(isFirstMessageSpam('Is this in stock?', 1)).toBe(false)
    expect(isFirstMessageSpam('Is this in stock?', 2)).toBe(true)
  })
  it('previews are one line of at most 140 characters', () => {
    expect(previewOf('Hello\n\n  there')).toBe('Hello there')
    const long = previewOf('x'.repeat(300))
    expect(long).toHaveLength(140)
    expect(long.endsWith('…')).toBe(true)
  })
  it('shortcuts are lower-case words', () => {
    expect(normaliseShortcut('/Size')).toBe('size')
    expect(normaliseShortcut('cod-info')).toBe('cod-info')
    expect(normaliseShortcut('two words')).toBeNull()
    expect(normaliseShortcut('')).toBeNull()
  })
})

describe('chat identity', () => {
  it('stores a hash of the cookie, never the cookie', () => {
    const token = newChatToken()
    expect(token.length).toBeGreaterThanOrEqual(43)
    const hash = hashChatToken(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(token)
    expect(hashChatToken(token)).toBe(hash)
    expect(hashChatToken('short')).toBeNull()
  })
  it('emails hash the same whatever the case; the key matters', () => {
    expect(inboxHash('email', 'A@X.co ', 'k')).toBe(inboxHash('email', 'a@x.co', 'k'))
    expect(inboxHash('email', 'a@x.co', 'k')).not.toBe(inboxHash('email', 'a@x.co', 'other'))
    expect(inboxHash('ip', '1.2.3.4', 'k')).not.toBe(inboxHash('email', '1.2.3.4', 'k'))
  })
})

describe('inbox rate limits', () => {
  it('ten messages a minute per conversation, then refused until the window passes', async () => {
    const store = createMemoryRateLimitStore()
    const checks = shopperMessageChecks({ conversationId: 'c1', ipHash: 'ip', kind: 'text' })
    const now = 1_000_000
    for (let i = 0; i < 10; i++) {
      expect((await checkInboxLimits(store, 's1', checks, now + i)).ok).toBe(true)
    }
    const refused = await checkInboxLimits(store, 's1', checks, now + 10)
    expect(refused).toMatchObject({ ok: false, rule: 'messagesPerMinute' })
    expect((await checkInboxLimits(store, 's1', checks, now + 61_000)).ok).toBe(true)
  })

  it('one store’s flood never spends another store’s budget', async () => {
    const store = createMemoryRateLimitStore()
    const checks = shopperMessageChecks({ conversationId: null, ipHash: 'ip', kind: 'text' })
    for (let i = 0; i < 5; i++) await checkInboxLimits(store, 'store-a', checks, i)
    expect((await checkInboxLimits(store, 'store-a', checks, 6)).ok).toBe(false)
    expect((await checkInboxLimits(store, 'store-b', checks, 6)).ok).toBe(true)
    expect(inboxLimitKey('newConversationPerIp', 'store-a', 'ip')).toContain('store-a')
  })

  it('images count against their own hourly limit', async () => {
    const store = createMemoryRateLimitStore()
    const checks = shopperMessageChecks({ conversationId: 'c1', ipHash: 'ip', kind: 'image' })
    for (let i = 0; i < 5; i++) await checkInboxLimits(store, 's', checks, i * 10_000)
    expect(await checkInboxLimits(store, 's', checks, 70_000)).toMatchObject({
      ok: false,
      rule: 'imagesPerHour',
    })
  })
})

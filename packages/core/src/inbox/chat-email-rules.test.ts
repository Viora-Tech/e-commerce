/** SOURCE OF TRUTH: Inbox chat email rules tests — WHAT: when a missed reply, a transcript or the team's waiting email is due, and how a message reads in it / WHY: these keep chat emails to one per chat per window and never about something already seen */
import { describe, expect, it } from 'vitest'
import {
  type ChatEmailClock,
  chatEmailLine,
  shopperReplyDue,
  staffAlertDue,
  transcriptDue,
  waitingLabel,
} from './chat-email-rules'

const NOW = new Date('2026-11-22T10:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

const clock = (over: Partial<ChatEmailClock> = {}): ChatEmailClock => ({
  status: 'open',
  lastSender: 'staff',
  lastMessageAt: ago(6),
  unreadShopper: 1,
  unreadStaff: 0,
  firstResponseAt: ago(6),
  closedAt: null,
  shopperEmailedAt: null,
  unansweredAlertedAt: null,
  anonymisedAt: null,
  ...over,
})

describe('shopperReplyDue', () => {
  it('emails a store reply the shopper has not seen for 5 minutes', () => {
    expect(shopperReplyDue(clock(), NOW)).toBe(true)
    expect(shopperReplyDue(clock({ lastSender: 'ai' }), NOW)).toBe(true)
  })

  it('waits while the reply is fresh, and skips one the shopper saw', () => {
    expect(shopperReplyDue(clock({ lastMessageAt: ago(4) }), NOW)).toBe(false)
    expect(shopperReplyDue(clock({ unreadShopper: 0 }), NOW)).toBe(false)
  })

  it('never emails when the shopper wrote last, or for a closed, blocked or old chat', () => {
    expect(shopperReplyDue(clock({ lastSender: 'shopper' }), NOW)).toBe(false)
    expect(shopperReplyDue(clock({ status: 'closed' }), NOW)).toBe(false)
    expect(shopperReplyDue(clock({ status: 'blocked' }), NOW)).toBe(false)
    expect(shopperReplyDue(clock({ lastMessageAt: ago(25 * 60) }), NOW)).toBe(false)
    expect(shopperReplyDue(clock({ anonymisedAt: ago(1) }), NOW)).toBe(false)
  })

  it('batches: one email per chat per 30 minutes, and none for a reply already emailed', () => {
    // Emailed 10 minutes ago, a new reply since: it waits for the gap.
    expect(shopperReplyDue(clock({ shopperEmailedAt: ago(10) }), NOW)).toBe(false)
    // The gap has passed and there is a reply newer than the email: send.
    expect(shopperReplyDue(clock({ shopperEmailedAt: ago(40), lastMessageAt: ago(8) }), NOW)).toBe(
      true,
    )
    // The email already covered the latest reply.
    expect(shopperReplyDue(clock({ shopperEmailedAt: ago(5), lastMessageAt: ago(40) }), NOW)).toBe(
      false,
    )
  })
})

describe('transcriptDue', () => {
  const closed = (over: Partial<ChatEmailClock> = {}) =>
    clock({ status: 'closed', closedAt: ago(3), lastMessageAt: ago(4), ...over })

  it('sends the chat once it has been closed a couple of minutes', () => {
    expect(transcriptDue(closed(), NOW)).toBe(true)
    expect(transcriptDue(closed({ closedAt: ago(1) }), NOW)).toBe(false)
    expect(transcriptDue(closed({ closedAt: ago(25 * 60) }), NOW)).toBe(false)
  })

  it('needs an answer from the store', () => {
    expect(transcriptDue(closed({ firstResponseAt: null, lastSender: 'shopper' }), NOW)).toBe(false)
    expect(transcriptDue(closed({ firstResponseAt: null, lastSender: 'ai' }), NOW)).toBe(true)
  })

  it('skips a chat whose latest message the shopper already had by email', () => {
    expect(transcriptDue(closed({ shopperEmailedAt: ago(2) }), NOW)).toBe(false)
    expect(transcriptDue(closed({ shopperEmailedAt: ago(30) }), NOW)).toBe(true)
  })

  it('never for an open or blocked chat', () => {
    expect(transcriptDue(clock({ closedAt: ago(3) }), NOW)).toBe(false)
    expect(transcriptDue(closed({ status: 'blocked' }), NOW)).toBe(false)
  })
})

describe('staffAlertDue', () => {
  const waiting = (over: Partial<ChatEmailClock> = {}) =>
    clock({ lastSender: 'shopper', unreadStaff: 1, unreadShopper: 0, ...over })

  it('lists a chat nobody opened for 5 minutes', () => {
    expect(staffAlertDue(waiting(), NOW)).toBe(true)
    expect(staffAlertDue(waiting({ lastMessageAt: ago(2) }), NOW)).toBe(false)
  })

  it('skips a chat someone opened or answered', () => {
    expect(staffAlertDue(waiting({ unreadStaff: 0 }), NOW)).toBe(false)
    expect(staffAlertDue(waiting({ lastSender: 'staff' }), NOW)).toBe(false)
    expect(staffAlertDue(waiting({ lastSender: 'ai' }), NOW)).toBe(false)
  })

  it('at most once per chat per 30 minutes, however many messages come in', () => {
    expect(staffAlertDue(waiting({ unansweredAlertedAt: ago(5.5) }), NOW)).toBe(false)
    expect(staffAlertDue(waiting({ unansweredAlertedAt: ago(20) }), NOW)).toBe(false)
    expect(staffAlertDue(waiting({ unansweredAlertedAt: ago(31) }), NOW)).toBe(true)
    // Listed after the latest message: nothing new to say.
    expect(
      staffAlertDue(waiting({ unansweredAlertedAt: ago(40), lastMessageAt: ago(45) }), NOW),
    ).toBe(false)
  })

  it('never for a blocked or closed chat', () => {
    expect(staffAlertDue(waiting({ status: 'blocked' }), NOW)).toBe(false)
    expect(staffAlertDue(waiting({ status: 'closed' }), NOW)).toBe(false)
  })
})

describe('chatEmailLine', () => {
  const names = { shopper: 'Asha', store: 'Waimers' }
  const time = () => '10:42 am'
  const at = NOW

  it('names the shopper and the store (a person or the AI agent alike)', () => {
    expect(
      chatEmailLine({ sender: 'shopper', kind: 'text', body: ' Hi ', createdAt: at }, names, time),
    ).toEqual({
      from: 'shopper',
      name: 'Asha',
      timeLabel: '10:42 am',
      text: 'Hi',
    })
    expect(
      chatEmailLine({ sender: 'ai', kind: 'text', body: 'Yes', createdAt: at }, names, time),
    ).toMatchObject({ from: 'store', name: 'Waimers' })
  })

  it('leaves out notes, system lines and cart updates', () => {
    for (const kind of ['note', 'system', 'cart_event']) {
      expect(
        chatEmailLine({ sender: 'staff', kind, body: 'x', createdAt: at }, names, time),
      ).toBeNull()
    }
    expect(
      chatEmailLine({ sender: 'system', kind: 'text', body: 'x', createdAt: at }, names, time),
    ).toBeNull()
  })

  it('labels a card with no text, and a discount by its code', () => {
    expect(
      chatEmailLine({ sender: 'staff', kind: 'image', body: '', createdAt: at }, names, time)?.text,
    ).toBe('[Sent a photo]')
    expect(
      chatEmailLine(
        { sender: 'staff', kind: 'discount', body: '', payload: { code: 'SAVE10' }, createdAt: at },
        names,
        time,
      )?.text,
    ).toBe('[Discount code SAVE10]')
    expect(
      chatEmailLine({ sender: 'shopper', kind: 'text', body: '  ', createdAt: at }, names, time),
    ).toBeNull()
  })
})

describe('waitingLabel', () => {
  it('reads in minutes, then hours', () => {
    expect(waitingLabel(ago(12), NOW)).toBe('Waiting 12 min')
    expect(waitingLabel(ago(0), NOW)).toBe('Waiting 1 min')
    expect(waitingLabel(ago(130), NOW)).toBe('Waiting 2 h')
  })
})

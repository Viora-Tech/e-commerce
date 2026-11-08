import { describe, expect, it } from 'vitest'
import { inboxConversationsContent as copy } from '@/data/inbox-conversations'
import {
  conversationName,
  initialsOf,
  matchQuickReplies,
  systemLine,
  withDayBreaks,
  withMessage,
} from './inbox-view'

describe('inbox view helpers', () => {
  it('names a conversation by customer, typed email, or Guest', () => {
    expect(conversationName({ name: 'Asha Rao', email: 'a@x.co' }, copy)).toBe('Asha Rao')
    expect(conversationName({ name: null, email: 'a@x.co' }, copy)).toBe('a@x.co')
    expect(conversationName({ name: ' ', email: null }, copy)).toBe('Guest')
    expect(initialsOf('Asha Rao')).toBe('AR')
    expect(initialsOf('guest')).toBe('GU')
  })

  it('words system and cart lines', () => {
    const name = (id: string) => (id === 'u1' ? 'Ravi' : 'someone')
    expect(systemLine('system', { event: 'assigned', to: 'u1' }, copy, name)).toBe(
      'Assigned to Ravi',
    )
    expect(systemLine('system', { event: 'closed' }, copy, name)).toBe('Closed the conversation')
    expect(
      systemLine('cart_event', { action: 'add', title: 'Kurta', quantity: 2 }, copy, name),
    ).toBe('Added 2 × Kurta to cart')
    expect(systemLine('cart_event', { action: 'remove', title: 'Kurta' }, copy, name)).toBe(
      'Removed Kurta from cart',
    )
  })

  it('adds a live message once, in time order', () => {
    const a = { id: '01a1-a' }
    const b = { id: '01a1-b' }
    expect(withMessage([b], a)).toEqual([a, b])
    expect(withMessage([a, b], b)).toEqual([a, b])
  })

  it('suggests quick replies after a slash only', () => {
    const replies = [
      { shortcut: 'size', title: 'Sizes' },
      { shortcut: 'cod', title: 'Cash on delivery' },
    ]
    expect(matchQuickReplies(replies, '/s')?.map((r) => r.shortcut)).toEqual(['size'])
    expect(matchQuickReplies(replies, '/')).toHaveLength(2)
    expect(matchQuickReplies(replies, 'hello /s')).toBeNull()
    expect(matchQuickReplies(replies, '/cash')?.map((r) => r.shortcut)).toEqual(['cod'])
  })

  it('puts a day divider before the first message of each day (store zone)', () => {
    const rows = withDayBreaks([
      { id: 'a', createdAt: '2026-11-07T17:00:00Z' },
      { id: 'b', createdAt: '2026-11-07T18:00:00Z' },
      // 00:00 IST on 8 Nov: a new day in the store's zone though still 7 Nov in UTC.
      { id: 'c', createdAt: '2026-11-07T18:30:00Z' },
    ])
    expect(rows.map((r) => (r.kind === 'day' ? 'day' : r.message.id))).toEqual([
      'day',
      'a',
      'b',
      'day',
      'c',
    ])
    expect(withDayBreaks([])).toEqual([])
  })
})

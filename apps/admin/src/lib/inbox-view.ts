import type { inboxConversationsContent } from '@/data/inbox-conversations'
import { dayKey } from './format-date'

/*
 * Small pure helpers the admin inbox shares between its panes: how a conversation is named,
 * what a system or cart line says, and how a live message joins a thread.
 */

type Copy = typeof inboxConversationsContent

/** A conversation's name in the list and header: the customer, what they typed, or "Guest". */
export function conversationName(
  c: { name: string | null; email: string | null },
  copy: Copy,
): string {
  return c.name?.trim() || c.email || copy.list.guest
}

/** Two letters for the avatar. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}` : name.slice(0, 2)
  return letters.toUpperCase()
}

type Payload = Record<string, unknown> | null

const str = (p: Payload, key: string): string =>
  typeof p?.[key] === 'string' ? (p[key] as string) : ''
const num = (p: Payload, key: string): number =>
  typeof p?.[key] === 'number' ? (p[key] as number) : 0

/** The words for a system line ("Assigned to Asha") or a cart line ("Added 2 × Kurta to cart"). */
export function systemLine(
  kind: string,
  payload: Payload,
  copy: Copy,
  nameOf: (userId: string) => string,
): string {
  if (kind === 'cart_event') {
    const title = str(payload, 'title')
    const qty = num(payload, 'quantity')
    const action = str(payload, 'action')
    if (action === 'remove') return copy.thread.cart.remove(title)
    if (action === 'quantity') return copy.thread.cart.quantity(title, qty)
    return copy.thread.cart.add(title, qty)
  }
  const event = str(payload, 'event')
  const s = copy.thread.system
  if (event === 'assigned') return s.assigned(nameOf(str(payload, 'to')))
  if (event === 'unassigned') return s.unassigned
  if (event === 'closed') return s.closed
  if (event === 'open') return s.open
  if (event === 'blocked') return s.blocked
  if (event === 'merged_guest') return s.merged_guest
  return ''
}

/** Adds a message to a thread once (by id), keeping time order (UUIDv7 ids sort by time). */
export function withMessage<T extends { id: string }>(messages: T[], message: T): T[] {
  if (messages.some((m) => m.id === message.id)) return messages
  const next = [...messages, message]
  next.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return next
}

/** A thread with a day divider before the first message of each calendar day (store zone). */
export function withDayBreaks<T extends { id: string; createdAt: Date | string }>(
  messages: readonly T[],
): ({ kind: 'day'; key: string; at: Date | string } | { kind: 'message'; message: T })[] {
  const out: ({ kind: 'day'; key: string; at: Date | string } | { kind: 'message'; message: T })[] =
    []
  let last: string | null = null
  for (const message of messages) {
    const key = dayKey(message.createdAt)
    if (key !== last) out.push({ kind: 'day', key, at: message.createdAt })
    last = key
    out.push({ kind: 'message', message })
  }
  return out
}

/** The quick replies whose shortcut or title starts with what follows `/` in the composer. */
export function matchQuickReplies<T extends { shortcut: string; title: string }>(
  replies: T[],
  draft: string,
): T[] | null {
  const m = /^\/(\S*)$/.exec(draft)
  if (!m) return null
  const q = (m[1] ?? '').toLowerCase()
  return replies.filter((r) => r.shortcut.startsWith(q) || r.title.toLowerCase().startsWith(q))
}

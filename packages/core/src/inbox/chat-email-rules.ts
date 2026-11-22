/** SOURCE OF TRUTH: shopperReplyDue, transcriptDue, staffAlertDue, chatEmailLine, CHAT_EMAIL_TIMING — WHAT: when an Inbox chat earns an email (a reply the shopper has not seen, a closed chat's transcript, a chat nobody on the team answered) and how one message reads in it / WHY: one place holds the "wait, then at most one email per chat per window, never for something already seen" rules, kept pure so they are unit-tested apart from the database and the worker. */
import type { ChatEmailMessage } from '@commerce/notifications'

const MINUTE = 60_000

export const CHAT_EMAIL_TIMING = {
  /** A store reply unseen this long: the shopper is away (the widget marks replies seen at once). */
  replyAwayMs: 5 * MINUTE,
  /** At most one "you have a reply" email per chat in this window; later replies wait and batch. */
  replyGapMs: 30 * MINUTE,
  /** A shopper message no team member opened for this long goes in the team email. */
  staffWaitMs: 5 * MINUTE,
  /** At most one team email per chat in this window, however many messages the shopper sends. */
  staffGapMs: 30 * MINUTE,
  /** A closed chat waits this long, so closing and reopening at once sends nothing. */
  transcriptSettleMs: 2 * MINUTE,
  /** Nothing is emailed about a chat quiet for longer than this (old chats on the first run). */
  maxAgeMs: 24 * 60 * MINUTE,
} as const

/** The conversation fields the rules read. */
export type ChatEmailClock = {
  status: 'open' | 'closed' | 'blocked'
  lastSender: 'shopper' | 'staff' | 'system' | 'ai' | null
  lastMessageAt: Date
  unreadShopper: number
  unreadStaff: number
  firstResponseAt: Date | null
  closedAt: Date | null
  /** When the shopper was last emailed about this chat (a reply or the transcript). */
  shopperEmailedAt: Date | null
  /** When the team email last listed this chat. */
  unansweredAlertedAt: Date | null
  anonymisedAt: Date | null
}

const ms = (d: Date) => d.getTime()

/** Nothing was emailed since `at`, and the last email was at least `gapMs` ago. */
function quietSince(emailedAt: Date | null, at: Date, now: Date, gapMs: number): boolean {
  if (!emailedAt) return true
  return ms(emailedAt) < ms(at) && ms(now) - ms(emailedAt) >= gapMs
}

/**
 * The store (a person or the AI agent) wrote last, the shopper has not opened the chat since,
 * and it has been a few minutes: email them the reply. Later replies inside the gap wait for
 * the next email, so a busy chat sends one email per half hour at most.
 */
export function shopperReplyDue(c: ChatEmailClock, now: Date): boolean {
  if (c.status !== 'open' || c.anonymisedAt) return false
  if (c.lastSender !== 'staff' && c.lastSender !== 'ai') return false
  if (c.unreadShopper <= 0) return false
  const age = ms(now) - ms(c.lastMessageAt)
  if (age < CHAT_EMAIL_TIMING.replyAwayMs || age > CHAT_EMAIL_TIMING.maxAgeMs) return false
  return quietSince(c.shopperEmailedAt, c.lastMessageAt, now, CHAT_EMAIL_TIMING.replyGapMs)
}

/**
 * The chat was closed a couple of minutes ago, the store answered in it, and there is
 * something the shopper has not had by email yet: send the whole chat once.
 */
export function transcriptDue(c: ChatEmailClock, now: Date): boolean {
  if (c.status !== 'closed' || !c.closedAt || c.anonymisedAt) return false
  if (!c.firstResponseAt && c.lastSender !== 'ai') return false
  const since = ms(now) - ms(c.closedAt)
  if (since < CHAT_EMAIL_TIMING.transcriptSettleMs || since > CHAT_EMAIL_TIMING.maxAgeMs) {
    return false
  }
  return !c.shopperEmailedAt || ms(c.shopperEmailedAt) < ms(c.lastMessageAt)
}

/**
 * The shopper wrote last (a new chat or a follow-up), no team member opened it, and it has
 * waited a few minutes: list it in the team email, at most once per chat per half hour.
 */
export function staffAlertDue(c: ChatEmailClock, now: Date): boolean {
  if (c.status !== 'open' || c.anonymisedAt) return false
  if (c.lastSender !== 'shopper' || c.unreadStaff <= 0) return false
  const age = ms(now) - ms(c.lastMessageAt)
  if (age < CHAT_EMAIL_TIMING.staffWaitMs || age > CHAT_EMAIL_TIMING.maxAgeMs) return false
  return quietSince(c.unansweredAlertedAt, c.lastMessageAt, now, CHAT_EMAIL_TIMING.staffGapMs)
}

/** A stored message as the email needs it. */
export type ChatLineInput = {
  sender: 'shopper' | 'staff' | 'system' | 'ai'
  kind: string
  body: string
  createdAt: Date
}

const CARD_LABELS: Record<string, string> = {
  product: '[Shared a product]',
  discount: '[Shared a discount code]',
  image: '[Sent a photo]',
}

/** Kinds a transcript leaves out: team notes, system lines and cart updates. */
const HIDDEN_KINDS = new Set(['note', 'system', 'cart_event'])

/**
 * One message as an email line, or null for what the shopper never sees as a message (notes,
 * system lines, cart updates). A card with no text reads as a short label; a discount card
 * says its code.
 */
export function chatEmailLine(
  m: ChatLineInput & { payload?: Record<string, unknown> | null },
  names: { shopper: string; store: string },
  timeLabel: (at: Date) => string,
): ChatEmailMessage | null {
  if (m.sender === 'system' || HIDDEN_KINDS.has(m.kind)) return null
  const code = m.kind === 'discount' && typeof m.payload?.code === 'string' ? m.payload.code : ''
  const label = code ? `[Discount code ${code}]` : (CARD_LABELS[m.kind] ?? '')
  const text = m.body.trim() || label
  if (!text) return null
  const fromShopper = m.sender === 'shopper'
  return {
    from: fromShopper ? 'shopper' : 'store',
    name: fromShopper ? names.shopper : names.store,
    timeLabel: timeLabel(m.createdAt),
    text,
  }
}

/** "Waiting 12 min", "Waiting 2 h". */
export function waitingLabel(since: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((ms(now) - ms(since)) / MINUTE))
  return minutes < 60 ? `Waiting ${minutes} min` : `Waiting ${Math.round(minutes / 60)} h`
}

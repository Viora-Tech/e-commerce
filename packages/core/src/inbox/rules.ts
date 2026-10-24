/** SOURCE OF TRUTH: canShopperAccess, isFirstMessageSpam, previewOf, normaliseShortcut — WHAT: the pure rules Inbox runs on every request: who may read a thread, when a guest's first message is spam, the list preview, quick reply shortcuts / WHY: kept pure so the rules are unit-tested apart from the database (design §5, §7). */
import { PREVIEW_MAX, SHORTCUT_PATTERN } from './constants'

/** Who is asking from the storefront: a signed-in customer, a guest's chat cookie hash, or both. */
export type ShopperIdentity = {
  customerId: string | null
  visitorKeyHash: string | null
}

type Owned = { customerId: string | null; visitorKeyHash: string | null }

/**
 * A thread tied to a customer is that customer's alone: a guest cookie on the same browser no
 * longer opens it once they sign out (shared computers). A guest thread opens with its cookie.
 */
export function canShopperAccess(conversation: Owned, who: ShopperIdentity): boolean {
  if (conversation.customerId) return who.customerId === conversation.customerId
  return Boolean(who.visitorKeyHash) && who.visitorKeyHash === conversation.visitorKeyHash
}

const LINK = /\b(?:https?:\/\/|www\.)\S+/gi

/** Links in a message (http(s):// or www.). */
export const linkCount = (body: string): number => body.match(LINK)?.length ?? 0

/**
 * A guest's first message goes straight to Blocked (reason spam) when it carries more than two
 * links, or when the same text already started two other conversations from the same IP.
 */
export function isFirstMessageSpam(body: string, sameTextFromIp: number): boolean {
  return linkCount(body) > 2 || sameTextFromIp >= 2
}

/** One line of at most 140 characters for the list. */
export function previewOf(body: string): string {
  const line = body.replace(/\s+/g, ' ').trim()
  return line.length > PREVIEW_MAX ? `${line.slice(0, PREVIEW_MAX - 1)}…` : line
}

/** `/Size ` → `size`; null when it cannot be a shortcut. */
export function normaliseShortcut(raw: string): string | null {
  const s = raw.trim().replace(/^\//, '').toLowerCase()
  return SHORTCUT_PATTERN.test(s) ? s : null
}

/** The same text typed twice compares equal: case and spacing do not matter. */
export const sameText = (body: string): string => body.replace(/\s+/g, ' ').trim().toLowerCase()

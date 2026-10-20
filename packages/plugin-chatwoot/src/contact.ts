import { createHmac } from 'node:crypto'
import type { ChatwootContact, ChatwootContactInput } from './client'
import type { ChatwootAttributes } from './widget'

/**
 * A customer as Chatwoot sees them: the same identifier (our customer id) and attributes from
 * the widget (`setUser`) and from the contact sync, so both land on one Chatwoot contact.
 * Pure, server side (the HMAC needs the inbox secret).
 */

/** What we know about a customer, read from the store's tables. */
export type CustomerFacts = {
  id: string
  name: string | null
  email: string | null
  /** Plaintext E.164 (`+919876543210`), when the customer has a phone. */
  phone: string | null
  createdAt: Date
  orderCount: number
  /** Cancelled orders do not count. */
  spentPaise: number
  lastOrderNumber: number | null
  lastOrderAt: Date | null
}

/** Chatwoot only takes phone numbers in E.164; anything else is left out. */
const E164 = /^\+[1-9]\d{7,14}$/

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/**
 * The custom attributes shown beside every conversation. Snake case, as Chatwoot's own are; add
 * them as contact attributes in Chatwoot (Settings → Custom attributes) for typed display.
 */
export function contactAttributes(facts: CustomerFacts): ChatwootAttributes {
  const attributes: ChatwootAttributes = {
    customer_since: isoDay(facts.createdAt),
    orders_count: facts.orderCount,
    total_spent: Math.round(facts.spentPaise) / 100,
  }
  if (facts.lastOrderNumber !== null) attributes.last_order = `#${facts.lastOrderNumber}`
  if (facts.lastOrderAt) attributes.last_order_at = isoDay(facts.lastOrderAt)
  return attributes
}

/** The contact we write for a customer. */
export function contactInput(facts: CustomerFacts): ChatwootContactInput {
  const phone = facts.phone?.replace(/[\s-]/g, '') ?? ''
  return {
    identifier: facts.id,
    ...(facts.name ? { name: facts.name } : {}),
    ...(facts.email ? { email: facts.email } : {}),
    ...(E164.test(phone) ? { phone_number: phone } : {}),
    custom_attributes: contactAttributes(facts),
  }
}

/** The widget's `identifier_hash`: HMAC-SHA256 of the identifier with the inbox's secret, hex. */
export function identifierHash(hmacToken: string, identifier: string): string {
  return createHmac('sha256', hmacToken).update(identifier).digest('hex')
}

const same = (a: unknown, b: unknown) =>
  (a ?? null) === (b ?? null) || String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase()

/**
 * Whether writing `input` would change `contact`. Unchanged contacts are not written, so a
 * retried or repeated sync costs one search and nothing else.
 */
export function contactNeedsUpdate(contact: ChatwootContact, input: ChatwootContactInput): boolean {
  if (contact.identifier !== input.identifier) return true
  if (input.name !== undefined && !same(contact.name, input.name)) return true
  if (input.email !== undefined && !same(contact.email, input.email)) return true
  if (input.phone_number !== undefined && !same(contact.phone, input.phone_number)) return true
  return Object.entries(input.custom_attributes).some(
    ([key, value]) => String(contact.customAttributes[key] ?? '') !== String(value),
  )
}

/**
 * The contact that is this customer, from a search's results: the one carrying our identifier,
 * else one with the same email (a shopper who chatted as a guest first), else the same phone.
 * A contact already tied to another identifier is never taken over.
 */
export function pickContact(
  contacts: readonly ChatwootContact[],
  who: { id: string; email: string | null; phone: string | null },
): ChatwootContact | null {
  const byId = contacts.find((c) => c.identifier === who.id)
  if (byId) return byId
  const free = contacts.filter((c) => c.identifier === null)
  const email = who.email?.toLowerCase()
  const byEmail = email ? free.find((c) => c.email?.toLowerCase() === email) : undefined
  if (byEmail) return byEmail
  const phone = who.phone?.replace(/[\s-]/g, '')
  return (phone ? free.find((c) => c.phone === phone) : undefined) ?? null
}

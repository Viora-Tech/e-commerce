/** SOURCE OF TRUTH: marketing recipient rules — WHAT: a marketing message goes only to the consenting customer's own stored email or phone, and the merchant's manual cart recovery is refused when a known customer for that contact has not consented / WHY: typed checkout contacts are unverified, so consent on one person must never reach another */
import { type ConsentChannel, type ConsentFlags, hasMarketingConsent } from '../privacy/client'
import { normalisePhone } from './audience'

/**
 * Consent belongs to one person, so a marketing message may only go to that
 * person's own address. A run (or a basket) carries the contact the shopper
 * typed, which is unverified: someone can put a subscriber's email on a cart
 * and a stranger's phone next to it. Before anything is sent under a
 * customer's consent, the address must be the one stored on that customer.
 */

/** Why a marketing step was skipped when the address is not the consenting customer's own. */
export const RECIPIENT_MISMATCH = 'recipient_mismatch'

export type RecipientCustomer = {
  email: string | null
  /** Decrypted `customer.phone`. */
  phone: string | null
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function samePhone(a: string, b: string): boolean {
  const x = normalisePhone(a)
  return x !== null && x === normalisePhone(b)
}

/**
 * Whether `to` is the customer's own stored email (email channel) or phone
 * (WhatsApp / SMS). No customer, or a customer with nothing stored on that
 * channel, never matches.
 */
export function recipientIsCustomers(
  channel: 'email' | 'phone',
  to: string | null | undefined,
  cu: RecipientCustomer | null | undefined,
): boolean {
  if (!to || !cu) return false
  const own = channel === 'email' ? cu.email : cu.phone
  if (!own) return false
  return channel === 'email' ? sameEmail(to, own) : samePhone(to, own)
}

/**
 * The merchant's one-off "Send recovery" on an abandoned checkout. Unlike an
 * automation it is not a campaign, and a guest who only typed a contact at
 * checkout has no consent record to check, so a single nudge to them is
 * treated as a service message about their own basket. But when the store
 * knows a customer behind the basket or that address (`known`), their
 * choice wins: anyone who has not said yes on the channel, unsubscribed or
 * was erased is not messaged.
 */
export function mayNudgeKnownContact(
  known: (ConsentFlags | null | undefined)[],
  channel: ConsentChannel,
): boolean {
  return known.every((c) => !c || hasMarketingConsent(c, channel))
}

/** Digit spellings of an Indian mobile (the blind index hashes digits only), so a lookup finds the customer. */
export function phoneLookupVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return []
  const local = digits.length >= 10 ? digits.slice(-10) : digits
  return [...new Set([digits, local, `91${local}`, `0${local}`])]
}

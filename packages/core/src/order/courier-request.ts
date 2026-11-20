/** SOURCE OF TRUTH: the shopper's "Want a different courier?" request — WHAT: the order tag, the cleaned text and the timeline note / WHY: owner, 20 Nov 2026: a shopper can name a courier the store does not list; the store calls them with the price before shipping. Pure. */

/** On an order whose shopper asked for another courier; the orders list filters on it. */
export const COURIER_REQUEST_TAG = 'courier-request'

/** Longest courier name kept ("DTDC Express Plus, please call first" fits). */
export const COURIER_REQUEST_MAX = 80

/** The request as kept: trimmed, one line, at most 80 characters; null when blank. */
export function cleanCourierRequest(raw: string | null | undefined): string | null {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, COURIER_REQUEST_MAX).trim()
  return text || null
}

/** The order timeline note the store sees. */
export const courierRequestNote = (courier: string): string =>
  `Shopper asked for another courier: ${courier}. Call them with the price before you ship.`

/**
 * SOURCE OF TRUTH KEYWORDS: buildSnapmintVisibility, readSnapmintVisibility, Visibility V2
 * WHAT:  Our availability question turned into Snapmint's Visibility V2 call
 *        (`POST /ext/v1/visibility`, "Visibility V2 Documentation"): the body (mobile, first and
 *        last name, order value in rupees, addresses, an empty payload), the shopper IP for
 *        `x-forwarded-for`, and a reader for the true/false answer.
 * WHY:   Pure, so the mapping and every answer shape are tested without a network. The reader
 *        answers null for a shape it does not know, and the caller then shows Snapmint.
 * WHERE: SnapmintProvider.checkAvailability (snapmint.ts).
 */
import type { AvailabilityInput } from '@commerce/payments'
import {
  isIp,
  paiseToRupees,
  snapmintAddress,
  snapmintMobile,
  splitName,
  VISIBILITY_ORDER_VALUE_CAP,
} from './cart'

export type SnapmintVisibilityRequest = {
  body: Record<string, unknown>
  /** The shopper's IP for `x-forwarded-for`, when we have one. */
  ip: string | null
}

/** Null without a 10-digit Indian mobile: Snapmint cannot be offered then at all. */
export function buildSnapmintVisibility(
  input: AvailabilityInput,
): SnapmintVisibilityRequest | null {
  const mobile = snapmintMobile(input.customer.phone)
  if (!mobile) return null
  const ship = input.shipping
  const name = splitName(input.customer.name ?? ship?.name)
  const body: Record<string, unknown> = {
    mobile,
    // V2 has first and last only; a middle name stays with the first.
    firstName: [name.firstName, name.middleName].filter(Boolean).join(' '),
    lastName: name.lastName,
    orderValue: Math.min(paiseToRupees(input.amountPaise), VISIBILITY_ORDER_VALUE_CAP),
    payload: {},
  }
  if (ship) {
    const address = snapmintAddress(ship)
    body.shippingAddress = address
    // Checkout asks before a separate billing address exists; Snapmint's carts use the same.
    body.billingAddress = address
  }
  const raw = input.customer.ip?.trim()
  // As for carts: local development has no proxy header, so loopback stands in.
  const ip = !isIp(raw) && process.env.NODE_ENV === 'development' ? '127.0.0.1' : raw
  return { body, ip: isIp(ip) ? ip : null }
}

const KEYS = ['visible', 'visibility', 'eligible', 'isEligible', 'is_eligible', 'result'] as const

const asBool = (v: unknown): boolean | null => {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return null
}

/**
 * Snapmint's eligibility: a bare `true`/`false`, or one of those (or "true"/"false") under
 * `visible`, `eligible`, `isEligible`, `is_eligible`, `visibility` or `result`, at the top or
 * under `data`. Null for anything else.
 */
export function readSnapmintVisibility(answer: unknown, depth = 0): boolean | null {
  const direct = asBool(answer)
  if (direct !== null) return direct
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null
  const o = answer as Record<string, unknown>
  for (const k of KEYS) {
    const v = asBool(o[k])
    if (v !== null) return v
  }
  return depth === 0 && 'data' in o ? readSnapmintVisibility(o.data, 1) : null
}

import type { PaymentRowStatus } from '@commerce/db'
import type { PaymentStatus } from '@commerce/payments'

export type { PaymentRowStatus }

/**
 * SOURCE OF TRUTH KEYWORDS: OPEN_ATTEMPT_STATUSES, open payment attempt
 * WHAT:  Attempts that may still turn into money: not yet asked, or waiting on the shopper or the bank.
 * WHY:   Expiry, follow-ups, fulfilment and the storefront's "awaiting payment" state must agree on
 *        what "still open" means; the storefront had two hand-copied sets.
 * WHERE: Core payments/preorder/order services; clients via `@commerce/core/order-status`.
 */
export const OPEN_ATTEMPT_STATUSES = ['created', 'pending', 'authorized'] as const

const RANK: Record<PaymentRowStatus, number> = {
  created: 0,
  pending: 1,
  authorized: 2,
  captured: 3,
  refunded: 4,
  failed: -1,
  cancelled: -1,
}

/**
 * Where an attempt goes when the gateway reports `incoming`, or null to ignore
 * the report. Statuses only move forward, so webhooks may arrive late, twice
 * or out of order:
 * - a repeat of the current status is a no-op;
 * - nothing moves a capture except a refund, and nothing moves a refund;
 * - `failed` and `cancelled` end an open attempt, but a later capture or
 *   authorisation still wins (Razorpay lets the shopper try again inside one
 *   gateway order, so a failed payment can be followed by a captured one).
 *
 * Pattern from Saleor's TransactionItem (BSD-3): the ledger only ever adds
 * events, and the charged amount never goes down except through a refund.
 */
export function nextPaymentStatus(
  current: PaymentRowStatus,
  incoming: PaymentStatus | PaymentRowStatus,
): PaymentRowStatus | null {
  if (current === incoming) return null
  if (current === 'refunded') return null
  if (current === 'captured') return incoming === 'refunded' ? 'refunded' : null
  if (incoming === 'refunded') return null
  const ended = current === 'failed' || current === 'cancelled'
  if (incoming === 'failed' || incoming === 'cancelled') return ended ? null : incoming
  if (ended) return incoming === 'captured' || incoming === 'authorized' ? incoming : null
  return RANK[incoming] > RANK[current] ? incoming : null
}

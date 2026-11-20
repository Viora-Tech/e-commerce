/**
 * SOURCE OF TRUTH KEYWORDS: snapmintPaymentStatus, normaliseSnapmintPost, snapmintEventFromTruth
 * WHAT:  Snapmint's order statuses (integration document v20250722 section 6.2.2) as our payment
 *        statuses, and its return post / S2S webhook (section 7) as our webhook events.
 * WHY:   Pure, so the mapping is tested on its own. The post is only a hint: the order status
 *        API decides (snapmint.ts `confirmWebhookEvent`, `confirm`).
 * WHERE: SnapmintProvider (snapmint.ts).
 */
import type { PaymentStatus, WebhookEvent } from '@commerce/payments'
import { rupeesToPaise } from './cart'

/** What the order status API says, as our status; null for a status we do not know. */
export function snapmintPaymentStatus(orderStatus: string): PaymentStatus | null {
  switch (orderStatus.trim().toUpperCase()) {
    case 'CAPTURED':
    case 'SETTLED':
    // Part of the money went back; the payment itself still stands (our refund rows say how much).
    case 'PARTIALLY_REFUNDED':
      return 'captured'
    case 'AUTHORIZED':
      return 'authorized'
    case 'REFUNDED':
      return 'refunded'
    case 'CANCELLED':
    case 'VOIDED':
    case 'ABANDONED':
      return 'failed'
    // Not paid yet, or Snapmint has no record of it yet: still open, the expiry job decides.
    case 'PENDING_STATUS':
    case 'NOT_FOUND':
      return 'pending'
    default:
      return null
  }
}

/** The return post or webhook body: Snapmint's field names, values as sent. */
export type SnapmintPost = Record<string, unknown> & {
  status?: unknown
  order_id?: unknown
  order_value?: unknown
  snapmint_id?: unknown
  message?: unknown
}

const str = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v)

/** `success` in the document's sample; anything else is read as not approved. */
export const postSucceeded = (post: SnapmintPost): boolean =>
  str(post.status).trim().toLowerCase() === 'success'

/** The event a checksum-verified post describes, before the order status API is asked. */
export function normaliseSnapmintPost(post: SnapmintPost): WebhookEvent {
  const providerRef = str(post.order_id)
  const snapmintId = str(post.snapmint_id) || null
  if (postSucceeded(post)) {
    return {
      type: 'payment.captured',
      providerRef,
      providerPaymentId: snapmintId ?? providerRef,
      amountPaise: rupeesToPaise(post.order_value),
      orderId: null,
      raw: post,
    }
  }
  return {
    type: 'payment.failed',
    providerRef,
    providerPaymentId: snapmintId,
    reason: str(post.message) || 'Snapmint did not approve the EMI',
    orderId: null,
    raw: post,
  }
}

/** One event per order and status: Snapmint retries a webhook up to three times. */
export const snapmintEventId = (post: SnapmintPost): string =>
  `${str(post.order_id)}:${str(post.status).trim().toLowerCase() || 'unknown'}`

export class SnapmintNotConfirmedYet extends Error {}

/**
 * The event to apply once the order status API has answered. The amount is the one in the
 * checksummed post (the status API does not return one). Still pending throws, so the webhook
 * fails and Snapmint sends it again; refunds come back as `ignored` (our refund rows track them).
 */
export function snapmintEventFromTruth(
  event: WebhookEvent,
  truth: { orderStatus: string; snapmintId: string | null },
): WebhookEvent {
  if (event.type !== 'payment.captured' && event.type !== 'payment.failed') return event
  const post = (event.raw ?? {}) as SnapmintPost
  const status = snapmintPaymentStatus(truth.orderStatus)
  const providerPaymentId = truth.snapmintId ?? event.providerPaymentId ?? event.providerRef
  const amountPaise = rupeesToPaise(post.order_value)
  const base = { providerRef: event.providerRef, orderId: null, raw: event.raw }
  if (status === 'captured') {
    return { ...base, type: 'payment.captured', providerPaymentId, amountPaise }
  }
  if (status === 'authorized') {
    return { ...base, type: 'payment.authorized', providerPaymentId, amountPaise }
  }
  if (status === 'failed') {
    const reason =
      event.type === 'payment.failed'
        ? event.reason
        : `Snapmint reports the order as ${truth.orderStatus}`
    return { ...base, type: 'payment.failed', providerPaymentId, reason }
  }
  if (status === 'refunded') {
    return { type: 'ignored', eventName: `order.${truth.orderStatus}`, raw: event.raw }
  }
  throw new SnapmintNotConfirmedYet(
    `Snapmint has not confirmed order ${event.providerRef} yet (${truth.orderStatus})`,
  )
}

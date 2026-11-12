/** SOURCE OF TRUTH: Cashfree webhook events — WHAT: the webhook body shape we read, the event id that de-duplicates resends, and how each Cashfree webhook (payment success/failed, charges, refund success/cancelled) becomes the platform's WebhookEvent / WHY: kept apart from the adapter so the translation is one readable table and cashfree.ts stays within its size */
import type { WebhookEvent } from '@commerce/payments'
import {
  type CfChargesDetails,
  type CfPaymentMethod,
  chargesFromDetails,
  methodOnly,
} from './charges'

/** A refund Cashfree accepted and then dropped: the money did not go back. */
const CASHFREE_REFUND_FAILED_STATUSES = new Set(['CANCELLED', 'FAILED'])

type CfWebhookOrder = {
  order_id: string
  order_amount: number
  order_currency: string
  order_tags?: Record<string, string> | null
}

type CfWebhookPayment = {
  cf_payment_id: string | number
  payment_status: string
  payment_amount: number
  payment_currency?: string
  payment_message?: string | null
  payment_time?: string
  payment_group?: string
  payment_method?: CfPaymentMethod | null
}

type CfWebhookRefund = {
  cf_refund_id: string | number
  cf_payment_id?: string | number
  refund_id: string
  order_id: string
  refund_amount: number
  refund_status: string
}

export type CfWebhookBody = {
  data?: {
    order?: CfWebhookOrder
    payment?: CfWebhookPayment
    refund?: CfWebhookRefund
    charges_details?: CfChargesDetails
    customer_details?: unknown
    type?: string
    event_time?: string
  }
  event_time?: string
  type?: string
}

/**
 * One id per event and payment (or refund), so a resent webhook is stored once. A refund sends
 * the same webhook type for each status it passes through (PENDING, ONHOLD, then SUCCESS or
 * CANCELLED), so its status is part of the id: otherwise the final word arrives as a
 * "duplicate" of the first and is never applied (#1593).
 */
export function cashfreeEventId(type: string, body: CfWebhookBody): string {
  const paymentId = body.data?.payment?.cf_payment_id
  const refund = body.data?.refund
  if (paymentId == null && refund?.cf_refund_id != null) {
    return `${type}:${refund.cf_refund_id}:${refund.refund_status ?? 'unknown'}`
  }
  return `${type}:${paymentId != null ? String(paymentId) : 'unknown'}`
}

/** A Cashfree webhook as the platform's event; anything we do not act on is `ignored`. */
export function normaliseCashfreeWebhook(type: string, body: CfWebhookBody): WebhookEvent {
  switch (type) {
    case 'PAYMENT_SUCCESS_WEBHOOK': {
      const order = body.data?.order
      const payment = body.data?.payment
      if (!order || !payment) break
      return {
        type: 'payment.captured',
        providerRef: order.order_id,
        providerPaymentId: String(payment.cf_payment_id),
        idempotencyKey: order.order_tags?.idempotencyKey ?? null,
        amountPaise: Math.round(payment.payment_amount * 100),
        orderId: order.order_tags?.orderId ?? null,
        // The fee comes later, in PAYMENT_CHARGES_WEBHOOK or from the fee sync.
        charges: methodOnly(payment),
        raw: body,
      }
    }
    // Sent once Cashfree has worked out its fee ("Success Payment TDR" in its dashboard).
    case 'PAYMENT_CHARGES_WEBHOOK': {
      const order = body.data?.order
      const payment = body.data?.payment
      const fee = chargesFromDetails(body.data?.charges_details)
      if (!order || !payment || fee.feePaise === null) break
      return {
        type: 'payment.charges',
        providerRef: order.order_id,
        providerPaymentId: String(payment.cf_payment_id),
        // Its payment_method may be empty; the success webhook already recorded the method.
        charges: { ...fee, method: null },
        orderId: order.order_tags?.orderId ?? null,
        raw: body,
      }
    }
    case 'PAYMENT_FAILED_WEBHOOK': {
      const order = body.data?.order
      const payment = body.data?.payment
      if (!order || !payment) break
      return {
        type: 'payment.failed',
        providerRef: order.order_id,
        providerPaymentId: payment.cf_payment_id != null ? String(payment.cf_payment_id) : null,
        idempotencyKey: order.order_tags?.idempotencyKey ?? null,
        reason: payment.payment_message ?? 'failed',
        orderId: order.order_tags?.orderId ?? null,
        raw: body,
      }
    }
    case 'REFUND_STATUS_WEBHOOK': {
      const refund = body.data?.refund
      if (refund && CASHFREE_REFUND_FAILED_STATUSES.has(refund.refund_status)) {
        return {
          type: 'refund.failed',
          providerRef: refund.order_id,
          providerRefundId: String(refund.cf_refund_id),
          reason: `Cashfree refund ${refund.refund_status.toLowerCase()}`,
          orderId: null,
          raw: body,
        }
      }
      if (refund?.refund_status !== 'SUCCESS') break
      return {
        type: 'refund.processed',
        providerRef: refund.order_id,
        providerRefundId: String(refund.cf_refund_id),
        amountPaise: Math.round(refund.refund_amount * 100),
        orderId: null,
        raw: body,
      }
    }
  }
  return { type: 'ignored', eventName: type, raw: body }
}

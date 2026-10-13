/** SOURCE OF TRUTH: Razorpay webhook events — WHAT: the webhook body shape we read and how each Razorpay event (payment captured/authorized/failed, UPI QR credited/closed, refund processed/failed) becomes the platform's WebhookEvent / WHY: kept apart from the adapter so the translation is one readable table and razorpay.ts stays within its size */
import type { WebhookEvent } from '@commerce/payments'
import { chargesOf, type RzpPayment } from './charges'

/** Razorpay's QR code entity, the fields we read. Notes may arrive as `[]` when empty. */
export type RzpQrCode = {
  id: string
  status: string
  image_url: string
  payment_amount?: number | null
  payments_amount_received?: number | null
  close_by?: number | null
  close_reason?: string | null
  notes?: Record<string, string> | null
}

export type RzpWebhookBody = {
  event?: string
  payload?: {
    payment?: { entity?: RzpPayment }
    refund?: { entity?: { id: string; amount: number; payment_id: string } }
    qr_code?: { entity?: RzpQrCode }
  }
}

/** A QR closes as `paid` once its single payment lands; that close is not a failure. */
export function qrWasPaid(qr: RzpQrCode): boolean {
  if (qr.close_reason === 'paid') return true
  const due = Number(qr.payment_amount ?? 0)
  return due > 0 && Number(qr.payments_amount_received ?? 0) >= due
}

/**
 * Checkout payments always belong to a Razorpay order we created (`providerRef`); one
 * without an order was made outside our checkout (anyone can open Checkout with the
 * public key id and put an attempt's `idempotencyKey` in its notes), so it is ignored.
 */
export function normaliseRazorpayWebhook(body: RzpWebhookBody): WebhookEvent {
  const pay = body.payload?.payment?.entity
  const qr = body.payload?.qr_code?.entity
  const orderId = pay?.notes?.orderId ?? qr?.notes?.orderId ?? null
  const idempotencyKey = pay?.notes?.idempotencyKey ?? qr?.notes?.idempotencyKey ?? null
  switch (body.event) {
    // A single-use UPI QR was paid: the QR id is the attempt's reference.
    case 'qr_code.credited':
      if (!pay || !qr) break
      return {
        type: 'payment.captured',
        providerRef: qr.id,
        providerPaymentId: pay.id,
        idempotencyKey,
        amountPaise: Number(pay.amount),
        orderId,
        charges: chargesOf(pay),
        raw: body,
      }
    // Closed unpaid (expired or closed by hand): the attempt failed, the shopper can get a new QR.
    case 'qr_code.closed':
      if (!qr || qrWasPaid(qr)) break
      return {
        type: 'payment.failed',
        providerRef: qr.id,
        providerPaymentId: null,
        idempotencyKey,
        reason: `UPI QR closed unpaid (${qr.close_reason ?? 'expired'})`,
        orderId,
        raw: body,
      }
    case 'payment.captured':
      if (!pay?.order_id) break
      return {
        type: 'payment.captured',
        providerRef: pay.order_id ?? '',
        providerPaymentId: pay.id,
        idempotencyKey,
        amountPaise: Number(pay.amount),
        orderId,
        charges: chargesOf(pay),
        raw: body,
      }
    case 'payment.authorized':
      if (!pay?.order_id) break
      return {
        type: 'payment.authorized',
        providerRef: pay.order_id ?? '',
        providerPaymentId: pay.id,
        idempotencyKey,
        amountPaise: Number(pay.amount),
        orderId,
        raw: body,
      }
    case 'payment.failed':
      if (!pay?.order_id) break
      return {
        type: 'payment.failed',
        providerRef: pay.order_id ?? '',
        providerPaymentId: pay.id,
        idempotencyKey,
        reason: pay.error_description ?? 'failed',
        orderId,
        raw: body,
      }
    case 'refund.processed': {
      const r = body.payload?.refund?.entity
      if (!r) break
      return {
        type: 'refund.processed',
        providerRef: pay?.order_id ?? '',
        providerRefundId: r.id,
        amountPaise: Number(r.amount),
        orderId,
        raw: body,
      }
    }
    case 'refund.failed': {
      const r = body.payload?.refund?.entity
      if (!r) break
      return {
        type: 'refund.failed',
        providerRef: pay?.order_id ?? '',
        providerRefundId: r.id,
        reason: 'Razorpay could not complete the refund',
        orderId,
        raw: body,
      }
    }
  }
  return { type: 'ignored', eventName: body.event ?? 'unknown', raw: body }
}

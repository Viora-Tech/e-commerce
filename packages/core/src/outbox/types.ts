import type { TemplateId } from '@commerce/notifications'
import type { AppEvent } from '@commerce/plugins'

/**
 * Reuses the event names already used by notifications and app hooks
 * (`order.paid`, `refund.created`, ...), plus a couple that had no shared
 * name yet. New types are additive; nothing here is store-specific.
 */
export type OutboxEventType =
  | 'order.placed'
  | 'order.paid'
  | 'order.fulfilled'
  | 'order.cancelled'
  | 'refund.created'
  | 'draft.invoice_sent'
  /** A deposit pre-order's balance was asked for (by the merchant or automatically). */
  | 'order.balance_requested'
  /** A reminder for a requested balance still unpaid. */
  | 'order.balance_reminder'
  /** The balance was captured (or recorded by hand); fulfilment is unblocked. */
  | 'order.balance_paid'
  /** The merchant sent a payment reminder for a manual UPI / bank transfer order. */
  | 'order.payment_reminder'
  /** Tells the merchant an unpaid transfer order will be auto-cancelled in 12 hours. */
  | 'order.unpaid_cancel_notice'
  /** A manual-transfer order was cancelled for non-payment (alongside `order.cancelled`). */
  | 'order.unpaid_cancelled'
  /** A variant's available stock (on-hand minus reserved) went from 0 to positive. */
  | 'inventory.restocked'
  /** A shipment's latest tracking scan looks like a failed delivery attempt (see `syncNdrFromTracking`). */
  | 'shipment.ndr_raised'
  /** A previously-open NDR cleared: the courier later reported delivered or RTO. */
  | 'shipment.ndr_resolved'
  /** A shopper (or the merchant on their behalf) asked to send items back. */
  | 'return.requested'
  /** The merchant accepted a return request. */
  | 'return.approved'
  /** The merchant declined a return request, with a reason. */
  | 'return.rejected'
  /** The returned parcel reached the merchant. */
  | 'return.received'
  /** Money went back for a return (to the original payment or as store credit). */
  | 'return.refunded'
  /** A shipment came back to the merchant undelivered (RTO); an RTO task was opened on the order. */
  | 'order.rto'

/**
 * `orderId` is required for every order-lifecycle type; `variantId` (and
 * optionally `locationId`) is required for `inventory.restocked`, which has
 * no order. Left as one loose shape (rather than a discriminated union) so
 * existing callers are untouched; each type's writer sets only the fields
 * that apply to it.
 */
export type OutboxPayload = {
  orderId?: string | undefined
  refundId?: string | undefined
  variantId?: string | undefined
  locationId?: string | undefined
  /** The return a `return.*` or `order.rto` event is about. */
  returnId?: string | undefined
}

export type OutboxEventRow = {
  id: string
  storeId: string
  type: OutboxEventType
  payload: OutboxPayload
  createdAt: Date
  dispatchedAt: Date | null
  attempts: number
  lastError: string | null
}

/**
 * The shopper-facing message this event triggers, if any. `null` means this
 * outbox type has no notification consumer (yet).
 */
export const OUTBOX_NOTIFICATION_TEMPLATE: Record<OutboxEventType, TemplateId | null> = {
  'order.placed': 'order_placed',
  'order.paid': 'payment_received',
  'order.fulfilled': 'order_shipped',
  'order.cancelled': null,
  'refund.created': null,
  'draft.invoice_sent': 'draft_invoice',
  'order.balance_requested': 'balance_request',
  'order.balance_reminder': 'balance_reminder',
  'order.balance_paid': 'balance_received',
  'order.payment_reminder': 'payment_reminder',
  'order.unpaid_cancel_notice': 'unpaid_cancel_notice',
  'order.unpaid_cancelled': 'unpaid_cancelled',
  // Handled by the back-in-stock plugin's own dispatch path, not the generic
  // per-order notification/app-hook fan-out (there is no order to attach it to).
  'inventory.restocked': null,
  // No merchant notification consumer yet - the Delivery problems queue reads
  // `shipment.ndrStatus` directly. A notification/app hook can be wired later
  // without touching `syncNdrFromTracking`, which only needs this row to exist.
  'shipment.ndr_raised': null,
  'shipment.ndr_resolved': null,
  'return.requested': 'return_requested',
  'return.approved': 'return_approved',
  'return.rejected': 'return_rejected',
  'return.received': 'return_received',
  'return.refunded': 'return_refunded',
  // The merchant sees the RTO task on the order and in Shipments; the shopper is not emailed.
  'order.rto': null,
}

/**
 * Events that may happen more than once per order (a merchant re-sends the
 * balance request, a second reminder). Their notification job is keyed by
 * the outbox row, not just (order, template), so each one is sent.
 */
export const REPEATABLE_OUTBOX_EVENTS: ReadonlySet<OutboxEventType> = new Set([
  'order.balance_requested',
  'order.balance_reminder',
  'order.payment_reminder',
  // An order can have several returns; each one's messages are their own.
  'return.requested',
  'return.approved',
  'return.rejected',
  'return.received',
  'return.refunded',
])

/**
 * The installed-app lifecycle event this outbox type fans out to, if any.
 * `null` means no app ever sees this one (there is no `AppEvent` for it).
 */
export const OUTBOX_APP_EVENT: Record<OutboxEventType, AppEvent | null> = {
  'order.placed': null,
  'order.paid': 'order.paid',
  'order.fulfilled': 'order.fulfilled',
  'order.cancelled': null,
  'refund.created': 'refund.created',
  'draft.invoice_sent': null,
  'order.balance_requested': null,
  'order.balance_reminder': null,
  'order.balance_paid': null,
  'order.payment_reminder': null,
  'order.unpaid_cancel_notice': null,
  'order.unpaid_cancelled': null,
  'inventory.restocked': null,
  'shipment.ndr_raised': null,
  'shipment.ndr_resolved': null,
  'return.requested': null,
  'return.approved': null,
  'return.rejected': null,
  'return.received': null,
  'return.refunded': null,
  'order.rto': null,
}

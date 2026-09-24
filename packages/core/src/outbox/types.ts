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

export type OutboxPayload = {
  orderId: string
  refundId?: string | undefined
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
}

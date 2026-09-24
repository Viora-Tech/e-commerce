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
}

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
}

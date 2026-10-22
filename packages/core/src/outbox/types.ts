import type { CustomMessage, TemplateId } from '@commerce/notifications'
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
  /** A shipment's tracking says the courier is out with it today. */
  | 'shipment.out_for_delivery'
  /** An order's fulfilment became delivered, from tracking or a manual "mark delivered". */
  | 'order.delivered'
  /** The merchant (or an automatic flow) cancelled an order and the shopper has not already been
   * told by a more specific message (unpaid transfer cancel has its own). Off by default when the
   * caller passes `notifyCustomer: false` to `cancelOrder`. */
  | 'order.cancel_notice'
  /** A newsletter signup waits for its confirm link (double opt-in); no order. */
  | 'newsletter.confirm_requested'
  /** A shopper sent a message from a theme's contact form (Forms app); the store's contact address is emailed. */
  | 'contact.message_received'
  /** A review request (or its one reminder) is due for an order (Reviews app); the shopper is emailed. */
  | 'review.request_due'
  /** The store replied to a review for the first time (Reviews app); the reviewer is emailed. */
  | 'review.replied'
  /** A live custom domain needs its HTTPS route on the proxy (`domains/routes.ts`). */
  | 'domain.route_requested'
  /** A removed custom domain's HTTPS route should be deleted from the proxy. */
  | 'domain.route_removed'
  /**
   * Products were created, edited or deleted. Apps that keep a copy of the catalogue (the
   * Meilisearch app's search index) get their `PRODUCTS_CHANGED_JOB` with the ids.
   */
  | 'catalog.products_changed'
  /** A customer was created (sign-up, first checkout, provider sign-in); apps such as Chatwoot sync it. */
  | 'customer.created'
  /** A customer's profile changed (checkout details, account page, admin edit). */
  | 'customer.updated'

/**
 * `orderId` is required for every order-lifecycle type; `variantId` (and
 * optionally `locationId`) is required for `inventory.restocked`, which has
 * no order. Left as one loose shape (rather than a discriminated union) so
 * existing callers are untouched; each type's writer sets only the fields
 * that apply to it.
 */
export type OutboxPayload = {
  orderId?: string | undefined
  /** A hand-sent message's edited subject and note (invoice, balance request, reminder). */
  custom?: CustomMessage | undefined
  refundId?: string | undefined
  variantId?: string | undefined
  locationId?: string | undefined
  /** The return a `return.*` or `order.rto` event is about. */
  returnId?: string | undefined
  /** The `newsletter_signup` a `newsletter.confirm_requested` event is about. */
  signupId?: string | undefined
  /** The `contact_message` a `contact.message_received` event is about. */
  contactMessageId?: string | undefined
  /** For `review.request_due`: the first request or the reminder. */
  reviewRequestKind?: 'request' | 'reminder' | undefined
  /** The `review` a `review.replied` event is about. */
  reviewId?: string | undefined
  /** The `store_domain` a `domain.route_requested` event is about. */
  domainId?: string | undefined
  /** For `domain.route_requested`: delete and re-create the Dokploy domain to force a new certificate attempt. */
  reregister?: boolean | undefined
  /** For `domain.route_removed`: the hostname, since its `store_domain` row is gone. */
  hostname?: string | undefined
  /** For `catalog.products_changed`: the products, which may no longer exist. */
  productIds?: string[] | undefined
  /** The customer a `customer.created` / `customer.updated` event is about. */
  customerId?: string | undefined
}

/**
 * The app job `catalog.products_changed` fans out to: any installed app whose manifest has a
 * job by this name gets `{ productIds }`.
 */
export const PRODUCTS_CHANGED_JOB = 'products.changed'

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
  // The order-page refund and the pre-order deposit refund both land here; a return's own
  // refund is skipped in the relay (see `dispatchRow`) since `return_refunded` already told
  // the shopper, and an RTO refund is merchant-only by design (see `order.rto` below).
  'refund.created': 'refund_issued',
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
  // The merchant sees the Delivery problems queue directly (reads `shipment.ndrStatus`);
  // the shopper gets `delivery_failed` telling them what they can do about it.
  'shipment.ndr_raised': 'delivery_failed',
  'shipment.ndr_resolved': null,
  'return.requested': 'return_requested',
  'return.approved': 'return_approved',
  'return.rejected': 'return_rejected',
  'return.received': 'return_received',
  'return.refunded': 'return_refunded',
  // The merchant sees the RTO task on the order and in Shipments; the shopper is not emailed.
  'order.rto': null,
  'shipment.out_for_delivery': 'out_for_delivery',
  'order.delivered': 'delivered',
  'order.cancel_notice': 'order_cancelled',
  // No order: the relay queues `newsletter_confirm` with the signup id itself (`dispatchRow`).
  'newsletter.confirm_requested': null,
  // No order: the relay queues `contact_message` with the message id itself (`dispatchRow`).
  'contact.message_received': null,
  // The relay queues `review_request` / `review_reminder` itself (`dispatchRow`), keyed by the row.
  'review.request_due': null,
  // The relay queues `review_reply` with the review id itself (`dispatchRow`).
  'review.replied': null,
  // Platform work, no message: the relay queues a `{domains}-route` job (`dispatchRow`).
  'domain.route_requested': null,
  'domain.route_removed': null,
  // Apps only: the relay queues `PRODUCTS_CHANGED_JOB` for apps that have it (`dispatchRow`).
  'catalog.products_changed': null,
  // App hooks only (`OUTBOX_APP_EVENT`): nobody is emailed about their own profile.
  'customer.created': null,
  'customer.updated': null,
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
  'shipment.out_for_delivery': null,
  'order.delivered': 'order.delivered',
  'order.cancel_notice': null,
  'newsletter.confirm_requested': null,
  'contact.message_received': null,
  'review.request_due': null,
  'review.replied': null,
  'domain.route_requested': null,
  'domain.route_removed': null,
  'catalog.products_changed': null,
  'customer.created': 'customer.created',
  'customer.updated': 'customer.updated',
}

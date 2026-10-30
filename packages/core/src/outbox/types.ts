import type { CustomMessage, TemplateId } from '@commerce/notifications'
import type { AppEvent } from '@commerce/plugins'
import type { AutomationCause } from '../automations/types'

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
  /** A return's exchange draft became an order; `orderId` is that new order, `returnId` the return. */
  | 'return.exchanged'
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
  /** A photo review earned its reward code (Reviews app); the reviewer is emailed the code. */
  | 'review.rewarded'
  /** A shopper asked a product question (Reviews app); the store's contact address is emailed. */
  | 'review.question_asked'
  /** A product question went live with its answer for the first time; the asker is emailed. */
  | 'review.question_answered'
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
  /** Affiliates app: an affiliate was approved; they are emailed their link and code. */
  | 'affiliate.approved'
  /** Affiliates app: an order earned an affiliate a (pending) commission; they are emailed. */
  | 'affiliate.commission_created'
  /** Affiliates app: a commission passed its hold (delivered, return window over) and can be paid. */
  | 'affiliate.commission_approved'
  /** Affiliates app: a commission was reversed (cancel, RTO, refund, self-referral). */
  | 'affiliate.commission_reversed'
  /** Affiliates app: the merchant marked a payout paid; the affiliate is emailed. */
  | 'affiliate.payout_paid'
  /** Affiliates app: a shopper applied and waits for approval; the merchant is emailed. */
  | 'affiliate.applied'
  /** Affiliates app: the merchant declined an affiliate; they are emailed (with the reason, if given). */
  | 'affiliate.rejected'
  /** A customer's tags changed (admin edit, bulk tag, an automation); payload has the diff. */
  | 'customer.tags_changed'
  /** A shopper gave marketing consent (newsletter confirm, checkout tick). Growth's welcome trigger. */
  | 'customer.subscribed'
  /** A product was created (admin, import, API). Written beside `catalog.products_changed`. */
  | 'product.created'
  /** A product was edited. Written beside `catalog.products_changed`. */
  | 'product.updated'
  /** A variant's available stock fell to or below the store's low-stock threshold (a crossing). */
  | 'inventory.low'
  /** A variant's available stock reached 0 (a crossing). */
  | 'inventory.out'
  /** An installed app fired one of its Automations triggers (`ctx.triggerAutomation`). */
  | 'automation.app_trigger'
  /** An automation's "Send order update" email: the relay queues the order email it names. */
  | 'automation.order_update'
  /** Tell the store owner about Automations: 80% / 100% of the month's runs, a workflow switched off. */
  | 'automation.owner_alert'
  /**
   * Platform apps (no consumer yet; for automations to subscribe to). A sales channel's catalog
   * sync failed or its access lapsed (`platform`: meta, google, openai; `message`: the platform's words).
   */
  | 'channel.sync_failed'
  /** Meta changed the store's WhatsApp Business account: restricted, disabled, quality, a failed send. */
  | 'whatsapp.account_updated'
  /** The Facebook user removed the platform's Meta app or asked for their data to go; Meta access ended. */
  | 'meta.access_removed'
  /** The merchant uninstalled the Koomerce app from their Shopify shop; its saved access went. */
  | 'shopify.app_uninstalled'
  /** Pixels app: Meta stopped accepting a pixel's Conversions API token; the owner is emailed once. */
  | 'pixel.connection_failed'
  /** COD & RTO app: a cash on delivery order waits for the shopper's confirm / cancel answer. */
  | 'order.cod_confirm_requested'
  /**
   * Staff edited a placed order's items, shipping or discount (`order/edit.ts`). The shopper gets
   * `order_edited` when the items or total changed (`notifyCustomer` false otherwise, and when the
   * edit's balance request already told them); apps re-bill (GST invoices) and recompute
   * (affiliate commission). Each edit is its own job.
   */
  | 'order.edited'
  /**
   * An online checkout's payment failed or was never finished a short while after it was placed
   * (`payments/pending-nudge.ts`): the shopper is asked once to retry. Written at most once per order.
   */
  | 'order.payment_pending'
  /** A shipment's tracking number or courier changed (re-booked after a cancel, or edited by hand). */
  | 'shipment.tracking_updated'
  /** Staff sent the shopper the link to their order page ("Send order link"). */
  | 'order.link_sent'

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
  /** A hand-sent message limited to one channel: `email` or `phone` (WhatsApp). Unset: every channel. */
  requires?: 'email' | 'phone' | undefined
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
  /** The `review_question` a `review.question_*` event is about (Reviews app). */
  questionId?: string | undefined
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
  /** The affiliate an `affiliate.*` event is about (Affiliates app). */
  affiliateId?: string | undefined
  /** The `affiliate_commission` an `affiliate.commission_*` event is about. */
  commissionId?: string | undefined
  /** The `affiliate_payout` an `affiliate.payout_paid` event is about. */
  payoutId?: string | undefined
  /** The product a `product.created` / `product.updated` / `inventory.*` event is about. */
  productId?: string | undefined
  /** For `customer.tags_changed`: what changed. */
  tagsAdded?: string[] | undefined
  tagsRemoved?: string[] | undefined
  /** For `automation.app_trigger`: the plugin trigger, its idempotency key and event data. */
  appTrigger?:
    | {
        trigger: string
        key: string
        subject?: { type: string; id: string } | undefined
        data?: Record<string, unknown> | undefined
      }
    | undefined
  /**
   * False: the shopper gets no message for this event (an automation fulfilled the order with
   * "Notify customer" off); app hooks and automations still see it. Absent means notify.
   */
  notifyCustomer?: boolean | undefined
  /** For `automation.owner_alert`: what to tell the owner. */
  ownerAlert?:
    | {
        kind: 'usage_80' | 'usage_100' | 'switched_off'
        workflowId?: string | undefined
        problem?: string | undefined
        runs?: number | undefined
        limit?: number | undefined
      }
    | undefined
  /** The shipment a `shipment.tracking_updated` event is about. */
  shipmentId?: string | undefined
  /** For `automation.order_update`: the order email template to send. */
  notificationTemplate?: string | undefined
  /** Set when an automation run caused this event (loop guard, design §8.5). */
  automation?: AutomationCause | undefined
  /** Platform-app events: the platform (`meta`, `google`, `openai`, `whatsapp`, `shopify`). */
  platform?: string | undefined
  /** Platform-app events: the outside account (catalog, WhatsApp Business account, shop). */
  externalId?: string | undefined
  /** Platform-app events: the new status, when the event changed one. */
  platformStatus?: string | undefined
  /** Platform-app events: the platform's own words, trimmed. */
  message?: string | undefined
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
  'return.exchanged': 'return_exchanged',
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
  // The relay queues `review_reward` with the review id itself (`dispatchRow`).
  'review.rewarded': null,
  // The relay queues `question_asked` / `question_answered` with the question id (`dispatchRow`).
  'review.question_asked': null,
  'review.question_answered': null,
  // Platform work, no message: the relay queues a `{domains}-route` job (`dispatchRow`).
  'domain.route_requested': null,
  'domain.route_removed': null,
  // Apps only: the relay queues `PRODUCTS_CHANGED_JOB` for apps that have it (`dispatchRow`).
  'catalog.products_changed': null,
  // App hooks only (`OUTBOX_APP_EVENT`): nobody is emailed about their own profile.
  'customer.created': null,
  'customer.updated': null,
  // The relay queues `affiliate_update` to the affiliate itself (`dispatchRow`), keyed by the row.
  'affiliate.approved': null,
  'affiliate.commission_created': null,
  // No message: for the Automations app and reports.
  'affiliate.commission_approved': null,
  'affiliate.commission_reversed': null,
  'affiliate.payout_paid': null,
  // The relay queues `affiliate_application` (merchant) and `affiliate_update` (rejected) itself.
  'affiliate.applied': null,
  'affiliate.rejected': null,
  // Automations triggers only (the relay's `{automations}-trigger` consumer).
  'customer.tags_changed': null,
  'customer.subscribed': null,
  'product.created': null,
  'product.updated': null,
  'inventory.low': null,
  'inventory.out': null,
  'automation.app_trigger': null,
  // The relay queues the named order email itself (`dispatchRow`).
  'automation.order_update': null,
  'automation.owner_alert': null,
  // Platform-app events have no message or app hook yet: they are there for automations.
  'channel.sync_failed': null,
  'whatsapp.account_updated': null,
  'meta.access_removed': null,
  'shopify.app_uninstalled': null,
  // The relay hands it to the Pixels app's `{pixels}-order` job, which emails the owner.
  'pixel.connection_failed': null,
  // COD & RTO app: the confirm / cancel link (WhatsApp when the store has it, else email).
  'order.cod_confirm_requested': 'cod_confirm',
  'order.edited': 'order_edited',
  'order.payment_pending': 'payment_pending',
  'shipment.tracking_updated': 'shipping_update',
  'order.link_sent': 'order_link',
}

/**
 * Events that may happen more than once per order (a merchant re-sends the
 * balance request, a second reminder). Their notification job is keyed by
 * the outbox row, not just (order, template), so each one is sent.
 */
export const REPEATABLE_OUTBOX_EVENTS: ReadonlySet<OutboxEventType> = new Set([
  // "Send invoice" again on a draft is the reminder: each send goes out.
  'draft.invoice_sent',
  'order.edited',
  'shipment.tracking_updated',
  'order.link_sent',
  'order.balance_requested',
  'order.balance_reminder',
  'order.payment_reminder',
  // An order can have several returns; each one's messages are their own.
  'return.requested',
  'return.approved',
  'return.rejected',
  'return.received',
  'return.refunded',
  'return.exchanged',
])

/**
 * The installed-app lifecycle event this outbox type fans out to, if any.
 * `null` means no app ever sees this one (there is no `AppEvent` for it).
 */
export const OUTBOX_APP_EVENT: Record<OutboxEventType, AppEvent | null> = {
  'order.placed': null,
  'order.paid': 'order.paid',
  'order.fulfilled': 'order.fulfilled',
  'order.cancelled': 'order.cancelled',
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
  'return.exchanged': null,
  'order.rto': 'order.rto',
  'shipment.out_for_delivery': null,
  'order.delivered': 'order.delivered',
  // The merchant's own cancel writes only this row; apps hear it as a cancel (one job per order).
  'order.cancel_notice': 'order.cancelled',
  'newsletter.confirm_requested': null,
  'contact.message_received': null,
  'review.request_due': null,
  'review.replied': null,
  'review.rewarded': null,
  'review.question_asked': null,
  'review.question_answered': null,
  'domain.route_requested': null,
  'domain.route_removed': null,
  'catalog.products_changed': null,
  'customer.created': 'customer.created',
  'customer.updated': 'customer.updated',
  'affiliate.approved': null,
  'affiliate.commission_created': null,
  'affiliate.commission_approved': null,
  'affiliate.commission_reversed': null,
  'affiliate.payout_paid': null,
  'affiliate.applied': null,
  'affiliate.rejected': null,
  'customer.tags_changed': null,
  'customer.subscribed': null,
  'product.created': null,
  'product.updated': null,
  'inventory.low': null,
  'inventory.out': null,
  'automation.app_trigger': null,
  'automation.order_update': null,
  'automation.owner_alert': null,
  'channel.sync_failed': null,
  'whatsapp.account_updated': null,
  'meta.access_removed': null,
  'shopify.app_uninstalled': null,
  'pixel.connection_failed': null,
  'order.cod_confirm_requested': null,
  'order.edited': 'order.edited',
  'order.payment_pending': null,
  'shipment.tracking_updated': null,
  'order.link_sent': null,
}

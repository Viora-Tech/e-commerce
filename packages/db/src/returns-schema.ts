import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { newId, order, orderLine, store } from './schema'

/* Returns: a shopper's return request or a courier's RTO, and the order lines it covers. */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

const RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'in_transit',
  'received',
  'resolved',
  'cancelled',
] as const
const RETURN_KINDS = ['return', 'rto'] as const
const RETURN_RESOLUTIONS = ['refund', 'exchange', 'store_credit', 'reship', 'none'] as const

/**
 * A shopper's request to send items back (`kind = return`), or a parcel the
 * courier brought back undelivered (`kind = rto`, created from tracking). One
 * row per request; the lines say which order lines and how many. A timestamp
 * per step drives the status timeline shoppers and staff see.
 *
 * Shape follows Saleor's order-return and Medusa's return models (BSD-3 / MIT):
 * a request with its own lines, separate from refunds and fulfilments. No code copied.
 */
export const returnRequest = pgTable(
  'return_request',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    /** Per-store running number, shown as R-12. */
    number: integer('number').notNull(),
    kind: text('kind', { enum: RETURN_KINDS }).notNull().default('return'),
    status: text('status', { enum: RETURN_STATUSES }).notNull().default('requested'),
    /** Reason code from the store's policy list (`@commerce/core/returns`). Null on RTO. */
    reason: text('reason'),
    customerNote: text('customer_note'),
    /** Public URLs of photos the shopper attached. */
    photos: text('photos').array().notNull().default([]),
    /** Why the merchant rejected it, shown to the shopper. */
    decisionNote: text('decision_note'),
    resolution: text('resolution', { enum: RETURN_RESOLUTIONS }),
    refundAmountPaise: integer('refund_amount_paise'),
    /** Refund rows written for this return (one per payment the money went back to). */
    refundIds: uuid('refund_ids').array().notNull().default([]),
    giftCardId: uuid('gift_card_id'),
    /** The draft order that sends the replacement for an exchange. */
    exchangeOrderId: uuid('exchange_order_id'),
    /** The new shipment when an RTO parcel is sent out again. */
    reshipShipmentId: uuid('reship_shipment_id'),
    /** For RTO: the shipment that came back. */
    shipmentId: uuid('shipment_id'),
    /** Put the items back in stock when received (defaults from the store policy). */
    restock: boolean('restock').notNull().default(true),
    restockedAt: timestamp('restocked_at', { withTimezone: true }),
    /** Condition check on arrival. */
    condition: text('condition', { enum: ['good', 'damaged', 'used'] }),
    conditionNote: text('condition_note'),
    /** `courier` = reverse pickup booked with a courier; `customer` = the shopper sends it. */
    pickupMethod: text('pickup_method', { enum: ['courier', 'customer'] }),
    pickupProvider: text('pickup_provider'),
    pickupWaybill: text('pickup_waybill'),
    pickupLabelUrl: text('pickup_label_url'),
    /** What the shopper asked for: money back, store credit, or the same item in another variant. */
    preferredResolution: text('preferred_resolution', {
      enum: ['refund', 'exchange', 'store_credit'],
    }),
    /** Approved by the store's auto-approve rule (Settings → Returns), not by a person. */
    autoApproved: boolean('auto_approved').notNull().default(false),
    /** What the courier charged for an RTO, typed by the merchant. */
    courierCostPaise: integer('courier_cost_paise'),
    requestedBy: text('requested_by', { enum: ['customer', 'merchant', 'system'] })
      .notNull()
      .default('customer'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    pickupArrangedAt: timestamp('pickup_arranged_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('return_request_store_number').on(t.storeId, t.number),
    index('return_request_store_status').on(t.storeId, t.status, t.requestedAt),
    index('return_request_order').on(t.orderId),
    /* One RTO task per returned shipment: re-applying the same tracking scan is a no-op. */
    uniqueIndex('return_request_rto_shipment').on(t.shipmentId).where(sql`${t.kind} = 'rto'`),
    check(
      'return_request_status_check',
      sql`${t.status} in ('requested', 'approved', 'rejected', 'in_transit', 'received', 'resolved', 'cancelled')`,
    ),
    check('return_request_kind_check', sql`${t.kind} in ('return', 'rto')`),
  ],
)

/** Which order lines, and how many units, a return covers. */
export const returnRequestLine = pgTable(
  'return_request_line',
  {
    id: id(),
    storeId: storeId(),
    returnRequestId: uuid('return_request_id')
      .notNull()
      .references(() => returnRequest.id),
    orderLineId: uuid('order_line_id')
      .notNull()
      .references(() => orderLine.id),
    quantity: integer('quantity').notNull(),
    /** Units put back in stock so far; a second restock click moves nothing. */
    restockedQuantity: integer('restocked_quantity').notNull().default(0),
    /** The variant the shopper wants instead (an exchange for another size); null for money back. */
    exchangeVariantId: uuid('exchange_variant_id'),
  },
  (t) => [
    index('return_request_line_request').on(t.returnRequestId),
    index('return_request_line_order_line').on(t.orderLineId),
    check('return_request_line_quantity_check', sql`${t.quantity} > 0`),
  ],
)

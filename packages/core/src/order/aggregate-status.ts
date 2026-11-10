/*
 * An order's three statuses, kept apart: where it is in its life (`status`),
 * where the money is (`payment_status`) and where the goods are
 * (`fulfillment_status`). Only the lifecycle is set by hand (draft, cancel);
 * the other two, and "completed", are derived here from payment attempts,
 * refunds, line quantities and shipments, then stored so lists can filter on
 * them. `recomputeOrderStatuses` (./recompute) is the one writer.
 *
 * Pattern from Medusa's `aggregate-status.ts` (MIT), which derives payment and
 * fulfilment status from the order's payments and fulfilments, and Saleor's
 * separate `charge_status` column (BSD-3). No code copied.
 *
 * Pure: no database import, so admin and storefront client code can use the
 * lists and types through `@commerce/core/order-status`.
 */

export { OPEN_ATTEMPT_STATUSES } from '../payments/transitions'

/**
 * SOURCE OF TRUTH KEYWORDS: ORDER_MARKS, OrderMark, mark order paid/fulfilled/delivered/cancelled
 * WHAT:  The hand moves a merchant can make on an order (one order or in bulk).
 * WHY:   The API's input enum and the admin's buttons and labels must list the same moves.
 * WHERE: `orders.setStatus`/bulk router input; admin orders list, order actions, copy.
 */
export const ORDER_MARKS = ['paid', 'fulfilled', 'delivered', 'cancelled'] as const
export type OrderMark = (typeof ORDER_MARKS)[number]

export const ORDER_LIFECYCLE_STATUSES = ['draft', 'open', 'completed', 'cancelled'] as const
export type OrderLifecycleStatus = (typeof ORDER_LIFECYCLE_STATUSES)[number]

/**
 * A placed order's lifecycle status (drafts have their own list/type and are
 * excluded here). The single source of truth — import this everywhere an
 * order's status is typed, instead of re-deriving `Exclude<OrderLifecycleStatus,
 * 'draft'>` locally.
 */
export type OrderStatus = Exclude<OrderLifecycleStatus, 'draft'>

export const ORDER_PAYMENT_STATUSES = [
  'unpaid',
  'authorized',
  'partially_paid',
  'paid',
  'partially_refunded',
  'refunded',
  'refund_needed',
] as const
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number]

export const ORDER_FULFILLMENT_STATUSES = [
  'unfulfilled',
  'partially_fulfilled',
  'fulfilled',
  'shipped',
  'partially_delivered',
  'delivered',
  'returned',
] as const
export type OrderFulfillmentStatus = (typeof ORDER_FULFILLMENT_STATUSES)[number]

/** Payment statuses where the money is still owed (the admin "Unpaid" tab). */
export const UNPAID_PAYMENT_STATUSES: readonly OrderPaymentStatus[] = [
  'unpaid',
  'authorized',
  'partially_paid',
]

/** Fulfilment statuses with units still to pack (the admin "Unfulfilled" tab). */
export const UNFULFILLED_STATUSES: readonly OrderFulfillmentStatus[] = [
  'unfulfilled',
  'partially_fulfilled',
]

/** Every unit is packed: the parcel has left or is ready to. */
export const PACKED_STATUSES: readonly OrderFulfillmentStatus[] = [
  'fulfilled',
  'shipped',
  'partially_delivered',
  'delivered',
]

/** Payment statuses meaning the order was paid in full at some point. */
export const SETTLED_PAYMENT_STATUSES: readonly OrderPaymentStatus[] = [
  'paid',
  'partially_refunded',
  'refunded',
]

/** Payment rows that took money (a full refund flips a capture to `refunded`). */
const TAKEN = new Set(['captured', 'refunded'])

export type PaymentFacts = {
  status: string
  amountPaise: number
  /** Captured money the order cannot keep; it is on its way back, not the order's. */
  refundNeeded: boolean
  /** Refunds recorded against this payment that did not fail. */
  refundedPaise: number
}

export type PaymentStatusInput = {
  totalPaise: number
  payments: readonly PaymentFacts[]
}

/** Money the order keeps: captured, not flagged for refund. */
export function capturedPaise(payments: readonly PaymentFacts[]): number {
  return payments
    .filter((p) => TAKEN.has(p.status) && !p.refundNeeded)
    .reduce((sum, p) => sum + p.amountPaise, 0)
}

/**
 * Where the money is. A flagged capture that has not gone back yet wins, since
 * someone has to act on it; then refunds, then how much of the total is in.
 */
export function derivePaymentStatus(input: PaymentStatusInput): OrderPaymentStatus {
  const { payments, totalPaise } = input
  const owedBack = payments.some(
    (p) => p.refundNeeded && TAKEN.has(p.status) && p.refundedPaise < p.amountPaise,
  )
  if (owedBack) return 'refund_needed'
  const kept = payments.filter((p) => TAKEN.has(p.status) && !p.refundNeeded)
  const captured = kept.reduce((sum, p) => sum + p.amountPaise, 0)
  const refunded = kept.reduce((sum, p) => sum + Math.min(p.refundedPaise, p.amountPaise), 0)
  if (captured > 0 && refunded >= captured) return 'refunded'
  if (refunded > 0) return 'partially_refunded'
  if (captured >= totalPaise && (captured > 0 || totalPaise <= 0)) return 'paid'
  if (captured > 0) return 'partially_paid'
  if (payments.some((p) => p.status === 'authorized' && !p.refundNeeded)) return 'authorized'
  return 'unpaid'
}

export type CheckoutDueInput = {
  totalPaise: number
  /** A deposit pre-order's deferred part; not due at checkout. */
  balanceDuePaise: number | null
  balancePaidAt: Date | null
}

/**
 * What checkout had to collect: the whole order, or only the deposit of a
 * deposit pre-order whose balance is still open.
 */
export function checkoutDuePaise(o: CheckoutDueInput): number {
  const deferred = o.balancePaidAt ? 0 : Math.max(0, o.balanceDuePaise ?? 0)
  return o.totalPaise - deferred
}

/**
 * A storefront checkout paid through a gateway. The order exists before the gateway opens, so
 * until the money arrives nothing is sold: `order.placed` waits for it (recompute.ts). Cash on
 * delivery and manual UPI or bank orders are real orders from the start.
 */
export function paysOnlineAtCheckout(o: {
  cartId: string | null
  importedFrom: string | null
  paymentMethod: string | null
}): boolean {
  const method = o.paymentMethod ?? 'manual'
  return o.cartId !== null && o.importedFrom === null && method !== 'cod' && method !== 'manual'
}

/** True once the money due at checkout is in: the moment an order counts as "paid" for `order.paid`. */
export function isCheckoutSettled(o: CheckoutDueInput, payments: readonly PaymentFacts[]): boolean {
  const captured = capturedPaise(payments)
  const due = checkoutDuePaise(o)
  return captured >= due && (captured > 0 || due <= 0)
}

export type LineFacts = { quantity: number; fulfilledQuantity: number; giftCard: boolean }
export type ShipmentFacts = { status: string }

export type FulfillmentStatusInput = {
  lines: readonly LineFacts[]
  shipments: readonly ShipmentFacts[]
  /** Set when the merchant marked the order delivered by hand (no courier tracking). */
  deliveredAt: Date | null
  /** Units a customer return brought back to the merchant (received returns only). */
  returnedUnits?: number | undefined
}

const IN_TRANSIT = new Set(['picked_up', 'in_transit', 'out_for_delivery'])

/**
 * Where the goods are. Line quantities say what was packed; shipments say
 * what the courier did with it. A courier return (RTO) on every live
 * shipment reads as returned.
 */
export function deriveFulfillmentStatus(input: FulfillmentStatusInput): OrderFulfillmentStatus {
  const live = input.shipments.filter((s) => s.status !== 'cancelled')
  const moving = live.filter((s) => s.status !== 'rto')
  if (live.length > 0 && moving.length === 0) return 'returned'
  const ordered = input.lines.reduce((sum, l) => sum + l.quantity, 0)
  // Every unit came back through a customer return.
  const physical = input.lines.filter((l) => !l.giftCard).reduce((sum, l) => sum + l.quantity, 0)
  if (physical > 0 && (input.returnedUnits ?? 0) >= physical) return 'returned'
  const packed = input.lines.reduce(
    (sum, l) => sum + Math.min(Math.max(l.fulfilledQuantity, 0), l.quantity),
    0,
  )
  const delivered = moving.filter((s) => s.status === 'delivered').length
  if (ordered === 0 || packed === 0) return 'unfulfilled'
  // Every courier booking was cancelled: the parcel is packed but going nowhere, so it is back
  // in To ship until it is booked again (an order packed with no booking at all stays fulfilled).
  if (input.shipments.length > 0 && live.length === 0 && !input.deliveredAt) return 'unfulfilled'
  if (packed < ordered) return delivered > 0 ? 'partially_delivered' : 'partially_fulfilled'
  if (input.deliveredAt) return 'delivered'
  if (moving.length === 0) return 'fulfilled'
  if (delivered === moving.length) return 'delivered'
  if (delivered > 0) return 'partially_delivered'
  if (moving.some((s) => IN_TRANSIT.has(s.status))) return 'shipped'
  return 'fulfilled'
}

export type LifecycleInput = {
  current: OrderLifecycleStatus
  payment: OrderPaymentStatus
  fulfillment: OrderFulfillmentStatus
  /** False for an order of gift cards only: nothing travels, so packed is done. */
  hasPhysicalLines: boolean
}

/**
 * Drafts and cancelled orders keep their status; they change only by hand.
 * An open order completes once it is paid and in the shopper's hands (or,
 * with nothing to ship, issued), and reopens if either stops being true.
 */
export function deriveLifecycle(input: LifecycleInput): OrderLifecycleStatus {
  if (input.current === 'draft' || input.current === 'cancelled') return input.current
  // Goods back and money back: nothing left to do on this order.
  if (input.fulfillment === 'returned' && input.payment === 'refunded') return 'completed'
  const paid = SETTLED_PAYMENT_STATUSES.includes(input.payment)
  const done =
    input.fulfillment === 'delivered' ||
    (input.fulfillment === 'fulfilled' && !input.hasPhysicalLines)
  return paid && done ? 'completed' : 'open'
}

/** Normalises anything outside the lifecycle list (old rows, bad input) to `open`. */
export function asLifecycle(status: string): OrderLifecycleStatus {
  return (ORDER_LIFECYCLE_STATUSES as readonly string[]).includes(status)
    ? (status as OrderLifecycleStatus)
    : 'open'
}

/**
 * Statuses for an order imported from another platform, from what that
 * platform said. Such orders are a record: no local payments, refunds or
 * shipments drive them.
 */
export function importedOrderStatuses(meta: {
  financialStatus?: string | null | undefined
  fulfillmentStatus?: string | null | undefined
  cancelledAt?: string | null | undefined
  /**
   * Each parcel's delivery stage on the source platform (Shopify's fulfillment
   * `displayStatus`, lowercase). Shopify calls an order "fulfilled" once a label exists, so
   * without these it would complete before the courier even collected it.
   */
  deliveryStatuses?: readonly string[] | null | undefined
}): {
  status: OrderLifecycleStatus
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
} {
  const financial = (meta.financialStatus ?? '').toLowerCase()
  const paymentStatus: OrderPaymentStatus =
    financial === 'paid' ||
    financial === 'partially_paid' ||
    financial === 'partially_refunded' ||
    financial === 'refunded' ||
    financial === 'authorized'
      ? financial
      : 'unpaid'
  const fulfilment = (meta.fulfillmentStatus ?? '').toLowerCase()
  const fulfillmentStatus: OrderFulfillmentStatus =
    fulfilment === 'fulfilled'
      ? 'fulfilled'
      : fulfilment === 'partial' || fulfilment === 'partially_fulfilled'
        ? 'partially_fulfilled'
        : fulfilment === 'restocked'
          ? 'returned'
          : 'unfulfilled'
  const stage = meta.deliveryStatuses
    ? deliveryStageOf(fulfillmentStatus, meta.deliveryStatuses)
    : fulfillmentStatus
  const settled = SETTLED_PAYMENT_STATUSES.includes(paymentStatus)
  // Without parcel stages (a CSV file) Shopify's "fulfilled" is all there is to go on.
  const done = meta.deliveryStatuses ? stage === 'delivered' : stage === 'fulfilled'
  const status: OrderLifecycleStatus = meta.cancelledAt
    ? 'cancelled'
    : settled && done
      ? 'completed'
      : 'open'
  return { status, paymentStatus, fulfillmentStatus: stage }
}

/** Parcel stages that mean the courier has it (Shopify's FulfillmentDisplayStatus). */
const SOURCE_MOVING = new Set([
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'attempted_delivery',
  'not_delivered',
  'failure',
])
/** Parcels that no longer count: cancelled, or a label thrown away. */
const SOURCE_DROPPED = new Set(['canceled', 'cancelled', 'label_voided'])

/**
 * Where an imported order's goods are, from each parcel's stage: every parcel delivered is
 * delivered, any with the courier is shipped, otherwise packed and waiting for pickup. A
 * partly packed order stays partly fulfilled unless a parcel already arrived.
 */
function deliveryStageOf(
  fulfilment: OrderFulfillmentStatus,
  statuses: readonly string[],
): OrderFulfillmentStatus {
  const live = statuses.filter((s) => !SOURCE_DROPPED.has(s))
  const delivered = live.filter((s) => s === 'delivered').length
  if (fulfilment === 'partially_fulfilled') {
    return delivered > 0 ? 'partially_delivered' : fulfilment
  }
  if (fulfilment !== 'fulfilled' || live.length === 0) return fulfilment
  if (delivered === live.length) return 'delivered'
  if (delivered > 0) return 'partially_delivered'
  if (live.some((s) => SOURCE_MOVING.has(s))) return 'shipped'
  return 'fulfilled'
}

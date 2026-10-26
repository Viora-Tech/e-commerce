/**
 * The chat's "Track my order" card, kept pure so the step rules are tested on their own. The
 * order's lifecycle, payment and fulfilment statuses and its latest courier shipment fold into
 * five steps a shopper reads at a glance (Confirmed → Packed → Shipped → Out for delivery →
 * Delivered), or one end state that replaces the timeline (cancelled, refunded, returning).
 */
import type {
  OrderFulfillmentStatus,
  OrderLifecycleStatus,
  OrderPaymentStatus,
  ShopperPaymentState,
} from '@commerce/core'

export const CHAT_TRACK_STEPS = [
  'confirmed',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const

export type ChatTrackStepKey = (typeof CHAT_TRACK_STEPS)[number]

/** `current` is the latest step reached: done like the ones before it, and drawn bold. */
export type ChatTrackStepState = 'done' | 'current' | 'todo'

export type ChatTrackStep = { key: ChatTrackStepKey; state: ChatTrackStepState }

/** An order that left the timeline: it is shown as this state instead. */
export type ChatOrderEnd = 'cancelled' | 'refunded' | 'returning'

/** The pill: the step reached, or the end state. */
export type ChatOrderStatus = ChatTrackStepKey | ChatOrderEnd

/** How the shopper paid, as the gateway reported it ("Paid by UPI"). */
export type ChatPaidBy = 'upi' | 'card' | 'netbanking' | 'wallet' | 'emi' | 'paylater'

/** Everything the chat's order card draws; money is formatted, dates are ISO strings. */
export type ChatOrderView = {
  number: number
  /** ISO instant. */
  placedAt: string
  /** The store's zone, so dates read the same on the server and in the browser. */
  timeZone: string
  /** "₹3,499". */
  total: string
  payment: ShopperPaymentState
  /** Null when the gateway did not say, or the order is not paid online. */
  paidBy: ChatPaidBy | null
  status: ChatOrderStatus
  /** Null when the order ended (`status` is a `ChatOrderEnd`). */
  steps: ChatTrackStep[] | null
  firstItem: {
    title: string
    /** Null for a product's only, placeholder variant. */
    variant: string | null
    quantity: number
    imageUrl: string | null
  } | null
  /** Lines beyond the first ("+ 2 more"). */
  moreItems: number
  /** The latest courier shipment; null before one is booked. */
  shipment: {
    /** The courier's name ("Delhivery"); null when the provider is not a known courier. */
    courier: string | null
    waybill: string
    trackingUrl: string | null
  } | null
  /** The courier's promised date, "YYYY-MM-DD"; null when it gave none. */
  expectedDate: string | null
  /** ISO instant the parcel was delivered; null until then. */
  deliveredAt: string | null
  /** The order's status page, through a signed per-order link. */
  viewUrl: string
}

export type ChatOrderProgressInput = {
  status: Exclude<OrderLifecycleStatus, 'draft'>
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
  /** The latest courier shipment's status, or null when none was booked. */
  shipmentStatus: string | null
  /** Set when the merchant marked the order delivered by hand. */
  deliveredAt: Date | string | null
}

/** Index into `CHAT_TRACK_STEPS` of the furthest step the parcel reached. */
function reachedStep(o: ChatOrderProgressInput): number {
  const ship = o.shipmentStatus
  if (
    o.deliveredAt ||
    o.status === 'completed' ||
    o.fulfillmentStatus === 'delivered' ||
    o.fulfillmentStatus === 'partially_delivered' ||
    ship === 'delivered'
  ) {
    return 4
  }
  if (ship === 'out_for_delivery') return 3
  if (ship === 'picked_up' || ship === 'in_transit' || o.fulfillmentStatus === 'shipped') return 2
  if (
    ship === 'created' ||
    o.fulfillmentStatus === 'fulfilled' ||
    o.fulfillmentStatus === 'partially_fulfilled'
  ) {
    return 1
  }
  return 0
}

/** The end state that replaces the timeline, or null while the order is on its way. */
function endState(o: ChatOrderProgressInput): ChatOrderEnd | null {
  if (o.status === 'cancelled') return 'cancelled'
  if (o.paymentStatus === 'refunded') return 'refunded'
  if (o.fulfillmentStatus === 'returned' || o.shipmentStatus === 'rto') return 'returning'
  return null
}

/** The order's pill and its five steps (null steps once it ended). */
export function chatOrderProgress(o: ChatOrderProgressInput): {
  status: ChatOrderStatus
  steps: ChatTrackStep[] | null
} {
  const end = endState(o)
  if (end) return { status: end, steps: null }
  const reached = reachedStep(o)
  return {
    status: CHAT_TRACK_STEPS[reached] as ChatTrackStepKey,
    steps: CHAT_TRACK_STEPS.map((key, i) => ({
      key,
      state: i < reached ? 'done' : i === reached ? 'current' : 'todo',
    })),
  }
}

const PAID_BY: Record<string, ChatPaidBy> = {
  upi: 'upi',
  card: 'card',
  netbanking: 'netbanking',
  wallet: 'wallet',
  emi: 'emi',
  cardless_emi: 'emi',
  paylater: 'paylater',
}

/** "Paid by UPI" only for a paid order whose gateway said how; null otherwise. */
export function chatPaidBy(payment: ShopperPaymentState, kind: string | null): ChatPaidBy | null {
  if (payment !== 'paid' || !kind) return null
  return PAID_BY[kind] ?? null
}

/** "Kurta" / "M" without the placeholder variant name. */
export function chatVariantName(variant: string | null): string | null {
  return variant && variant !== 'Default' && variant !== 'Default Title' ? variant : null
}

import { OPEN_ATTEMPT_STATUSES } from '@commerce/core/order-status'
import type { OrderMark } from '@/data/orders'

/** The forward moves an open order can make by hand (cancel is never "next"). */
export type OrderMove = Exclude<OrderMark, 'cancelled'>

const OWED: ReadonlySet<string> = new Set(['unpaid', 'authorized', 'partially_paid'])
const TO_PACK: ReadonlySet<string> = new Set(['unfulfilled', 'partially_fulfilled'])
const ON_ITS_WAY: ReadonlySet<string> = new Set(['fulfilled', 'shipped', 'partially_delivered'])

/** The order page's action label for each move (`orderDetailContent.actions`). */
export const MOVE_ACTION = {
  paid: 'markPaid',
  fulfilled: 'fulfil',
  delivered: 'deliver',
} as const satisfies Record<OrderMove, string>

/** What else decides the move, beyond the three statuses. */
export type MoveFacts = {
  /** Cash on delivery: the courier collects it, so it never blocks packing. */
  cod?: boolean | undefined
  /** Fulfilment is on hold (#1011): nothing is packed or handed over until it is released. */
  held?: boolean | undefined
  /** The member may pack (`orders.fulfil`); false hides Mark as fulfilled / delivered. */
  canPack?: boolean | undefined
}

/**
 * The one forward step for an open order: take the money, then pack, then hand over. Cash on
 * delivery is the exception, as on the Next step card: pack and hand over first, then collect.
 * Shared by the order page's More actions and the orders list's row menu.
 */
export function nextOrderMove(
  status: string,
  payment: string,
  fulfilment: string | null,
  facts: MoveFacts = {},
): OrderMove | undefined {
  if (status !== 'open') return undefined
  const owed = OWED.has(payment)
  if (owed && !facts.cod) return 'paid'
  const f = fulfilment ?? 'unfulfilled'
  const packs = !facts.held && facts.canPack !== false
  if (TO_PACK.has(f)) return packs ? 'fulfilled' : undefined
  if (ON_ITS_WAY.has(f)) return packs ? 'delivered' : undefined
  return owed ? 'paid' : undefined
}

/** A courier status after which the booking can no longer be cancelled from the list. */
const ENDED_DELIVERY: ReadonlySet<string> = new Set([
  'cancelled',
  'delivered',
  'rto',
  'rto_delivered',
])
const BOOKED: ReadonlySet<string> = new Set(['fulfilled', 'partially_fulfilled', 'shipped'])

/**
 * The orders list's "Cancel shipment": the order page's rule, a label bought from a courier that
 * is still live. A tracking number typed by hand (no label) or no shipment at all is undone with
 * Mark as unfulfilled instead; offering a cancel there only ended in an error.
 */
export function listCancelsShipment(o: {
  status: string
  fulfillmentStatus: string | null
  deliveryStatus?: string | null | undefined
  labelLive?: boolean | null | undefined
}): boolean {
  return (
    o.status === 'open' &&
    BOOKED.has(o.fulfillmentStatus ?? '') &&
    Boolean(o.deliveryStatus) &&
    !ENDED_DELIVERY.has(o.deliveryStatus ?? '') &&
    o.labelLive === true
  )
}

/** UPI to the store's own ID: the merchant matches the transfer by hand (`MANUAL_METHOD`). */
const MANUAL_TRANSFER = 'manual'

/**
 * Whether "Send payment reminder" applies: an open order still waiting on a UPI or bank
 * transfer the merchant matches by hand. The API also enforces this (and the 6-hour gap).
 */
export function canRemindToPay(o: {
  status: string
  paymentStatus: string
  paymentMethod: string | null
}): boolean {
  return o.status === 'open' && o.paymentMethod === MANUAL_TRANSFER && o.paymentStatus === 'unpaid'
}

/** Money the store still holds on a cancelled order: it has to go back ("Refund due"). */
const HELD_ON_CANCEL: ReadonlySet<string> = new Set([
  'paid',
  'partially_paid',
  'partially_refunded',
  'refund_needed',
])

/**
 * The payment chip's value (list and order header). A cancelled order nobody paid reads
 * "Voided", not "Unpaid" (#123); one still holding money reads "Refund due", and one whose money
 * all went back "Refunded" (owner, 11 Nov 2026).
 */
export function shownPaymentStatus(o: { status: string; paymentStatus: string }): string {
  if (o.status !== 'cancelled') return o.paymentStatus
  if (HELD_ON_CANCEL.has(o.paymentStatus)) return 'refund_due'
  return o.paymentStatus === 'refunded' ? 'refunded' : 'voided'
}

const OPEN_ATTEMPT: ReadonlySet<string> = new Set(OPEN_ATTEMPT_STATUSES)
const CAPTURED_ATTEMPT: ReadonlySet<string> = new Set([
  'captured',
  'partially_refunded',
  'refund_needed',
])

/**
 * One payment attempt's chip on the order page. On a cancelled order an attempt still open
 * shows nothing (never "Payment pending" under Voided), and money captured and not all sent
 * back reads "Refund due". Null: no chip.
 */
export function shownAttemptStatus<T extends string>(
  orderStatus: string,
  pill: T,
): T | 'refund_due' | null {
  if (orderStatus !== 'cancelled') return pill
  if (OPEN_ATTEMPT.has(pill)) return null
  return CAPTURED_ATTEMPT.has(pill) ? 'refund_due' : pill
}

/**
 * Bulk "Mark as fulfilled": which selected orders get a call. Rows on screen that are not open,
 * are imported or have nothing left to pack are skipped without one; ids not on screen go to the
 * API, which refuses what it cannot pack.
 */
export function bulkFulfilPlan(
  ids: readonly string[],
  loaded: readonly {
    id: string
    status: string
    fulfillmentStatus: string | null
    importedFrom: string | null
  }[],
): { due: string[]; skipped: number } {
  const byId = new Map(loaded.map((o) => [o.id, o]))
  const due = ids.filter((id) => {
    const o = byId.get(id)
    return (
      !o ||
      (o.status === 'open' && !o.importedFrom && TO_PACK.has(o.fulfillmentStatus ?? 'unfulfilled'))
    )
  })
  return { due, skipped: ids.length - due.length }
}

/**
 * Bulk "Mark as delivered" only hands over what already went to a courier (packed or on its
 * way); anything else is skipped and counted, never packed and delivered in one go (owner,
 * 11 Nov 2026). The API refuses the same (`onlyShipped`).
 */
export function undeliverableInBulk(o: {
  status: string
  fulfillmentStatus: string | null
}): boolean {
  return o.status !== 'open' || !ON_ITS_WAY.has(o.fulfillmentStatus ?? 'unfulfilled')
}

const PACKED_NOT_DELIVERED: ReadonlySet<string> = new Set([
  'fulfilled',
  'partially_fulfilled',
  'shipped',
])

/**
 * The undo actions an order offers, one rule for the order page's More actions and the orders
 * list's row menu (owner, 11 Nov 2026: the two menus disagreed). Imported history offers none.
 * Permissions are checked by each menu; the API refuses what cannot be undone and says why.
 */
export function orderUndos(o: {
  status: string
  fulfillmentStatus: string | null
  importedFrom?: string | null | undefined
  /** Units the order's lines read packed (the order page knows; the list does not). */
  packedUnits?: number | undefined
}): { unfulfil: boolean; undeliver: boolean; restore: boolean } {
  if (o.importedFrom) return { unfulfil: false, undeliver: false, restore: false }
  const open = o.status === 'open'
  const f = o.fulfillmentStatus ?? 'unfulfilled'
  // Items packed under a cancelled label read Unfulfilled while their lines say packed (#1535):
  // Mark as unfulfilled is their way back to To ship.
  const strayPacked = f === 'unfulfilled' && (o.packedUnits ?? 0) > 0
  return {
    unfulfil: open && (PACKED_NOT_DELIVERED.has(f) || strayPacked),
    undeliver: open && f === 'delivered',
    restore: o.status === 'cancelled',
  }
}

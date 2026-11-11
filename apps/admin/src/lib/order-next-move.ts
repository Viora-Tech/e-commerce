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

/** The payment chip's value: a cancelled order nobody paid reads "Voided", not "Unpaid" (#123). */
export function shownPaymentStatus(o: { status: string; paymentStatus: string }): string {
  return o.status === 'cancelled' && o.paymentStatus === 'unpaid' ? 'voided' : o.paymentStatus
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

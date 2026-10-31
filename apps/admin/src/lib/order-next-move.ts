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

/**
 * The one forward step for an open order: take the money, then pack, then hand over.
 * Shared by the order page's More actions and the orders list's row menu.
 */
export function nextOrderMove(
  status: string,
  payment: string,
  fulfilment: string | null,
): OrderMove | undefined {
  if (status !== 'open') return undefined
  if (OWED.has(payment)) return 'paid'
  const f = fulfilment ?? 'unfulfilled'
  if (TO_PACK.has(f)) return 'fulfilled'
  if (ON_ITS_WAY.has(f)) return 'delivered'
  return undefined
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

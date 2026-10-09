import type { OrderDetail } from './order-detail-types'

export type NextStepKind = 'upi' | 'collect' | 'ship' | 'transit' | 'done' | 'cancelled'

type NextStepFlags = {
  /** Imported history is a record: no next step. */
  readOnly: boolean
  /** Money is owed and can be recorded by hand. */
  canCollect: boolean
  /** Lines are still waiting to be packed. */
  canFulfil: boolean
  /** A manual UPI / bank transfer the merchant has not matched yet. */
  awaitingTransfer: boolean
}

const ON_ITS_WAY = new Set(['fulfilled', 'shipped', 'partially_delivered'])

/**
 * The one thing this order is waiting for, in the order a merchant works: check the transfer,
 * collect what is owed (cash on delivery is collected by the courier, so it never blocks
 * packing), pack it, hand it over, then done.
 */
export function nextStepKind(order: OrderDetail, f: NextStepFlags): NextStepKind | null {
  if (f.readOnly) return null
  if (order.status === 'cancelled') return 'cancelled'
  if (order.fulfillmentStatus === 'delivered') return 'done'
  if (f.awaitingTransfer && f.canCollect) return 'upi'
  const cod = order.paymentMethod === 'cod'
  if (f.canCollect && !cod) return 'collect'
  if (f.canFulfil) return 'ship'
  if (ON_ITS_WAY.has(order.fulfillmentStatus)) return 'transit'
  return null
}

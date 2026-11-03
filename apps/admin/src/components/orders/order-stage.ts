import type { OrderFulfillmentStatus, OrderStatus } from '@/data/orders'

/**
 * What a list row's status column shows: open orders by where the goods are,
 * closed ones (completed, cancelled) by their lifecycle.
 */
export function orderStage(o: {
  status: OrderStatus | 'draft'
  fulfillmentStatus: OrderFulfillmentStatus
}):
  | { kind: 'order'; value: OrderStatus | 'draft' }
  | { kind: 'fulfilment'; value: OrderFulfillmentStatus } {
  return o.status === 'open'
    ? { kind: 'fulfilment', value: o.fulfillmentStatus }
    : { kind: 'order', value: o.status }
}

/** Packed and on its way or done with: nothing left to pack. */
const PACKED = new Set<OrderFulfillmentStatus>(['fulfilled', 'shipped', 'delivered', 'returned'])

/**
 * A row with no work left on it, drawn dimmed in the Orders list like Shopify's: cancelled,
 * completed or archived, or every item already packed.
 */
export function orderRowDone(o: {
  status: OrderStatus | 'draft'
  fulfillmentStatus: OrderFulfillmentStatus
  archivedAt?: Date | string | null | undefined
}): boolean {
  if (o.archivedAt) return true
  if (o.status === 'cancelled' || o.status === 'completed') return true
  return o.status === 'open' && PACKED.has(o.fulfillmentStatus)
}

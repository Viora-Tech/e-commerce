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

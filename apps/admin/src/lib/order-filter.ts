import { type OrderListFilter, type OrderStatus, PENDING_UPI } from '@/data/orders'

/** The Orders tab as `orders.list` input: a status, or the Pending UPI view. */
export function orderListFilter(f: OrderListFilter | null): {
  status?: OrderStatus | undefined
  pendingUpi?: true | undefined
} {
  if (f === PENDING_UPI) return { pendingUpi: true }
  return f ? { status: f } : {}
}

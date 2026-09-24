import type { OrderListFilter } from '@/data/orders'

/** The Orders tab as `orders.list` input: every tab is a server-side view; none is All. */
export function orderListFilter(f: OrderListFilter | null): { view?: OrderListFilter } {
  return f ? { view: f } : {}
}

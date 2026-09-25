import type { api } from '@/lib/api-client'
import { formatDate, formatDateTime } from '@/lib/format-date'

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof api.customers.get>>>
export type CustomerOrder = CustomerDetail['orders'][number]
export type CustomerMessage = CustomerDetail['notifications'][number]

export const when = formatDateTime

export const day = formatDate

/** Mean of non-cancelled orders; zero when there is nothing to average. */
export function averageOrderPaise(orders: CustomerOrder[]): number {
  const live = orders.filter((o) => o.status !== 'cancelled')
  if (live.length === 0) return 0
  return Math.round(live.reduce((sum, o) => sum + o.totalPaise, 0) / live.length)
}

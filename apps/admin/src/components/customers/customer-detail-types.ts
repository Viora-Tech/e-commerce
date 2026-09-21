import type { api } from '@/lib/api-client'

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof api.customers.get>>>
export type CustomerOrder = CustomerDetail['orders'][number]
export type CustomerMessage = CustomerDetail['notifications'][number]

export const when = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export const day = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })

/** Mean of non-cancelled orders; zero when there is nothing to average. */
export function averageOrderPaise(orders: CustomerOrder[]): number {
  const live = orders.filter((o) => o.status !== 'cancelled')
  if (live.length === 0) return 0
  return Math.round(live.reduce((sum, o) => sum + o.totalPaise, 0) / live.length)
}

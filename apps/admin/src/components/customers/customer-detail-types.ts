import { ACTIVE_WINDOW_DAYS, VIP_SPEND_PAISE } from '@/data/customers'
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

/** A saved address, or (`id` null) the latest order's address before it is in the book. */
export type CustomerAddressRow = Omit<CustomerDetail['addresses'][number], 'id'> & {
  id: string | null
}

const DAY_MS = 86_400_000

export type NextStep =
  | { kind: 'vip'; orders: number; spentPaise: number }
  | { kind: 'winBack'; days: number }

/**
 * The one suggestion the Next step card shows, only when the orders back it: someone gone quiet
 * for the active window gets a win-back, a big spender who is still active gets a thank-you.
 */
export function nextStepFor(customer: CustomerDetail, now = new Date()): NextStep | null {
  const { orderCount, spentPaise, lastOrderAt } = customer.totals
  if (orderCount === 0 || !lastOrderAt) return null
  const days = Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / DAY_MS)
  if (days >= ACTIVE_WINDOW_DAYS) return { kind: 'winBack', days }
  if (spentPaise >= VIP_SPEND_PAISE) return { kind: 'vip', orders: orderCount, spentPaise }
  return null
}

export type ActivityEvent =
  | { id: string; kind: 'order'; at: Date | string; number: number; totalPaise: number }
  | {
      id: string
      kind: 'message'
      at: Date | string
      template: string
      channel: string
      failed: boolean
    }
  | { id: string; kind: 'note'; at: Date | string; body: string }

/** Orders placed, messages sent and staff notes, newest first: everything recorded about them. */
export function activityFor(customer: CustomerDetail): ActivityEvent[] {
  const orders = customer.orders.map(
    (o): ActivityEvent => ({
      id: `order-${o.id}`,
      kind: 'order',
      at: o.placedAt,
      number: o.number,
      totalPaise: o.totalPaise,
    }),
  )
  const messages = customer.notifications.map(
    (m): ActivityEvent => ({
      id: `message-${m.id}`,
      kind: 'message',
      at: m.createdAt,
      template: m.template,
      channel: m.channel,
      failed: m.status === 'failed',
    }),
  )
  const notes = customer.notes.map(
    (n): ActivityEvent => ({ id: `note-${n.id}`, kind: 'note', at: n.createdAt, body: n.body }),
  )
  return [...orders, ...messages, ...notes].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )
}

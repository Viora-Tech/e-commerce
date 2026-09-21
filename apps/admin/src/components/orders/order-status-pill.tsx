import { StatusPill } from '@/components/layout/status-pill'
import { ORDER_STATUS_TONE, type OrderStatus, ordersContent } from '@/data/orders'

/** Dot + label variant used in cards and the detail page. */
export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <StatusPill tone={ORDER_STATUS_TONE[status]}>{ordersContent.status[status]}</StatusPill>
}

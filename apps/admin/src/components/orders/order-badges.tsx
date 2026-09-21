import { Badge } from '@commerce/ui/shadcn/badge'
import { StatusPill } from '@/components/layout/status-pill'
import { ORDER_STATUS_TONE, type OrderStatus, ordersContent } from '@/data/orders'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_TONE[status]}>{ordersContent.status[status]}</Badge>
}

/** Dot + label variant used in tables (kit style). */
export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <StatusPill tone={ORDER_STATUS_TONE[status]}>{ordersContent.status[status]}</StatusPill>
}

type PaymentBadgeProps = { status: OrderStatus; paymentMethod: string | null }

export function OrderPaymentBadge({ status, paymentMethod }: PaymentBadgeProps) {
  if (paymentMethod === 'cod') {
    return status === 'placed' ? (
      <StatusPill tone="warning">{ordersContent.payment.codPending}</StatusPill>
    ) : (
      <StatusPill tone="neutral">{ordersContent.payment.cod}</StatusPill>
    )
  }
  return <StatusPill tone="success">{ordersContent.payment.paid}</StatusPill>
}

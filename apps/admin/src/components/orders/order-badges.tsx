import { Badge } from '@commerce/ui/shadcn/badge'
import { ORDER_STATUS_TONE, type OrderStatus, ordersContent } from '@/data/orders'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_TONE[status]}>{ordersContent.status[status]}</Badge>
}

type PaymentBadgeProps = { status: OrderStatus; paymentMethod: string | null }

export function OrderPaymentBadge({ status, paymentMethod }: PaymentBadgeProps) {
  if (paymentMethod === 'cod') {
    return status === 'placed' ? (
      <Badge variant="warning">{ordersContent.payment.codPending}</Badge>
    ) : (
      <Badge variant="neutral">{ordersContent.payment.cod}</Badge>
    )
  }
  return <Badge variant="success">{ordersContent.payment.paid}</Badge>
}

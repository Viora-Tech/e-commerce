import { Badge } from '@commerce/ui/shadcn/badge'
import { ORDER_STATUS_TONE, type OrderStatus, ordersContent } from '@/data/orders'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_TONE[status]}>{ordersContent.status[status]}</Badge>
}

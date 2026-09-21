import { cn } from '@commerce/ui/lib/utils'
import {
  CircleCheck,
  type LucideIcon,
  PackageCheck,
  PackageOpen,
  PackageX,
  Truck,
} from 'lucide-react'
import { type OrderStatus, ordersContent } from '@/data/orders'

/* Frame 5:2624: a 24px glyph and the label 8px apart; delivered green,
   pending amber, cancelled red, in transit plain. */
const STATUS_CELL: Record<OrderStatus, { icon: LucideIcon; className: string }> = {
  placed: { icon: PackageOpen, className: 'text-warning-foreground dark:text-warning' },
  paid: { icon: CircleCheck, className: 'text-foreground' },
  fulfilled: { icon: Truck, className: 'text-foreground' },
  delivered: { icon: PackageCheck, className: 'text-success' },
  cancelled: { icon: PackageX, className: 'text-destructive' },
}

/** Status column of the order list. */
export function OrderStatusCell({ status }: { status: OrderStatus }) {
  const { icon: Icon, className } = STATUS_CELL[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-body', className)}>
      <Icon className="size-4" strokeWidth={1.5} />
      {ordersContent.status[status]}
    </span>
  )
}

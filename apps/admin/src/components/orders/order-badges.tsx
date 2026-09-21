import { cn } from '@commerce/ui/lib/utils'
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  CircleCheck,
  type LucideIcon,
  PackageCheck,
  PackageOpen,
  PackageX,
  Truck,
} from 'lucide-react'
import { StatusPill } from '@/components/layout/status-pill'
import { ORDER_STATUS_TONE, type OrderStatus, ordersContent } from '@/data/orders'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_STATUS_TONE[status]}>{ordersContent.status[status]}</Badge>
}

/** Dot + label variant used in cards and the detail page. */
export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <StatusPill tone={ORDER_STATUS_TONE[status]}>{ordersContent.status[status]}</StatusPill>
}

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

type PaymentProps = { status: OrderStatus; paymentMethod: string | null }

function paymentState({ status, paymentMethod }: PaymentProps) {
  if (paymentMethod === 'cod') {
    return status === 'placed'
      ? { label: ordersContent.payment.codPending, dot: 'bg-destructive', tone: 'warning' as const }
      : {
          label: ordersContent.payment.cod,
          dot: 'bg-muted-foreground-soft',
          tone: 'neutral' as const,
        }
  }
  return { label: ordersContent.payment.paid, dot: 'bg-success', tone: 'success' as const }
}

/* Frame 5:2621: 8px dot, label in body ink. */
export function OrderPaymentCell(props: PaymentProps) {
  const { label, dot } = paymentState(props)
  return (
    <span className="inline-flex items-center gap-2 text-body text-foreground">
      <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  )
}

/** Coloured pill used outside tables (order detail header). */
export function OrderPaymentBadge(props: PaymentProps) {
  const { label, tone } = paymentState(props)
  return <StatusPill tone={tone}>{label}</StatusPill>
}

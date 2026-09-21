import { type OrderStatus, ordersContent } from '@/data/orders'

export type PaymentProps = { status: OrderStatus; paymentMethod: string | null }

export function paymentState({ status, paymentMethod }: PaymentProps) {
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

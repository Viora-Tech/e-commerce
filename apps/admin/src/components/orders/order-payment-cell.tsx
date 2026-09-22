import { cn } from '@commerce/ui/lib/utils'
import { type PaymentProps, paymentState } from './order-payment-state'

/* Frame 5:2621: 8px dot, label in body ink. */
export default function OrderPaymentCell(props: PaymentProps) {
  const { label, dot } = paymentState(props)
  return (
    <span className="inline-flex items-center gap-2 text-kit-cell text-foreground">
      <span className={cn('size-2 shrink-0 rounded-full', dot)} aria-hidden="true" />
      {label}
    </span>
  )
}

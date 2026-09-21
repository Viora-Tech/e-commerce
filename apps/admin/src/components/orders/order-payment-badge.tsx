import StatusPill from '@/components/layout/status-pill'
import { type PaymentProps, paymentState } from './order-payment-state'

/** Coloured pill used outside tables (order detail header). */
export default function OrderPaymentBadge(props: PaymentProps) {
  const { label, tone } = paymentState(props)
  return <StatusPill tone={tone}>{label}</StatusPill>
}

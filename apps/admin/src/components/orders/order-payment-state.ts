import type { OrderStatus } from '@/data/orders'
import type { StatusValue } from '@/data/status'

export type PaymentProps = { status: OrderStatus; paymentMethod: string | null }

/** Which `STATUS.payment` value the list shows: COD orders are unpaid until placed moves on. */
export function paymentStatusOf({ status, paymentMethod }: PaymentProps): StatusValue<'payment'> {
  if (paymentMethod === 'cod') return status === 'placed' ? 'unpaid' : 'cod'
  return 'paid'
}

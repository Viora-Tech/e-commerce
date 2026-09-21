import type { StatusTone } from '@/components/layout/status-pill'
import { orderDetailContent as copy } from '@/data/orders'
import type { api } from '@/lib/api-client'

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof api.orders.get>>>
export type OrderStatus = OrderDetail['status']
export type OrderPayment = OrderDetail['payments'][number]
export type OrderRefund = OrderDetail['refunds'][number]
export type OrderShipment = OrderDetail['shipment']

export const when = (iso: string | Date) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

export const cap = (s: string) => (s[0]?.toUpperCase() ?? '') + s.slice(1)

/** Paise sent back to the shopper across every refund that did not fail. */
export function refundedTotal(refunds: OrderRefund[], paymentId?: string): number {
  return refunds
    .filter((r) => r.status !== 'failed' && (!paymentId || r.paymentId === paymentId))
    .reduce((sum, r) => sum + r.amountPaise, 0)
}

/** The payment row a refund would go against: the captured one, else the latest. */
export function primaryPayment(payments: OrderPayment[]): OrderPayment | null {
  return payments.find((p) => p.status === 'captured') ?? payments.at(-1) ?? null
}

export function paymentPill(
  payment: OrderPayment | null,
  refunds: OrderRefund[],
): { tone: StatusTone; label: string } {
  if (!payment) return { tone: 'neutral', label: copy.pills.payment.pending }
  const back = refundedTotal(refunds, payment.id)
  if (payment.status === 'captured' && back > 0) {
    return { tone: 'warning', label: copy.pills.partiallyRefunded }
  }
  const tone: Record<OrderPayment['status'], StatusTone> = {
    pending: 'warning',
    captured: 'success',
    refunded: 'destructive',
    failed: 'destructive',
  }
  return { tone: tone[payment.status], label: copy.pills.payment[payment.status] }
}

export function fulfilmentPill(status: OrderStatus): { tone: StatusTone; label: string } {
  if (status === 'delivered') return { tone: 'success', label: copy.pills.fulfilment.delivered }
  if (status === 'fulfilled') return { tone: 'info', label: copy.pills.fulfilment.fulfilled }
  return { tone: 'neutral', label: copy.pills.fulfilment.unfulfilled }
}

export function methodLabel(provider: string): string {
  return copy.payment.method[provider] ?? cap(provider)
}

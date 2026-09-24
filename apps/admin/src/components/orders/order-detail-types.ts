import { orderDetailContent as copy } from '@/data/orders'
import type { StatusValue } from '@/data/status'
import type { api } from '@/lib/api-client'

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof api.orders.get>>>
export type OrderStatus = OrderDetail['status']
export type OrderPayment = OrderDetail['payments'][number]
export type OrderRefund = OrderDetail['refunds'][number]
export type OrderShipment = OrderDetail['shipment']
export type OrderLine = OrderDetail['lines'][number]

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

/** Which `STATUS.payment` value the detail header shows for a payment row. */
export function paymentStatus(
  payment: OrderPayment | null,
  refunds: OrderRefund[],
): StatusValue<'payment'> {
  if (!payment) return 'pending'
  const back = refundedTotal(refunds, payment.id)
  if (payment.status === 'captured' && back > 0) return 'partially_refunded'
  return payment.status
}

/** Which `STATUS.fulfilment` value an order status maps to. */
export function fulfilmentStatus(status: OrderStatus): StatusValue<'fulfilment'> {
  if (status === 'delivered') return 'delivered'
  if (status === 'fulfilled') return 'fulfilled'
  return 'unfulfilled'
}

/** Lines with something still to pack, with how many are left on each. */
/* A fulfilled or delivered order is packed in full, even when its lines carry no
   fulfilment rows (demo data and orders moved by status before line tracking existed). */
const PACKED_STATUSES: ReadonlySet<string> = new Set(['fulfilled', 'delivered'])

/** How many of a line have gone out: the recorded count, or all of it once the order is packed. */
export function packedQuantity(order: OrderDetail, line: OrderLine): number {
  return PACKED_STATUSES.has(order.status) ? line.quantity : line.fulfilledQuantity
}

export function unfulfilledLines(order: OrderDetail): { line: OrderLine; remaining: number }[] {
  return order.lines
    .map((line) => ({ line, remaining: line.quantity - packedQuantity(order, line) }))
    .filter((l) => l.remaining > 0)
}

/** Gateways settle themselves; these two are collected by the merchant. */
const OFFLINE_METHODS = new Set(['cod', 'manual'])

export function isOfflineMethod(method: string | null): boolean {
  return method !== null && OFFLINE_METHODS.has(method)
}

export function methodLabel(provider: string): string {
  return copy.payment.method[provider] ?? cap(provider)
}

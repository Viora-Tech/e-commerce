import { orderDetailContent } from '@/data/order-detail'
import type { StatusValue } from '@/data/status'
import type { api } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format-date'

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof api.orders.get>>>
export type OrderStatus = OrderDetail['status']
export type OrderPayment = OrderDetail['payments'][number]
export type OrderRefund = OrderDetail['refunds'][number]
export type OrderShipment = OrderDetail['shipment']
export type OrderLine = OrderDetail['lines'][number]

export const when = formatDateTime

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
  // Captured on a cancelled or already-paid order and not yet sent back.
  if (payment.status === 'captured' && payment.refundNeeded && back < payment.amountPaise) {
    return 'refund_needed'
  }
  // From the money, not the row alone: "Refunded" only once all of it went back. Rows a part
  // refund's webhook once set to `refunded` read as partly refunded too.
  const taken = payment.status === 'captured' || payment.status === 'refunded'
  if (taken && back >= payment.amountPaise) return 'refunded'
  if (taken && back > 0) return 'partially_refunded'
  return payment.status
}

/**
 * How many of a line have gone out. The line count is the record; the order's
 * fulfilment status is derived from it, so the two can no longer disagree.
 */
export function packedQuantity(_order: OrderDetail, line: OrderLine): number {
  return Math.min(line.fulfilledQuantity, line.quantity)
}

/** Lines with something still to pack, with how many are left on each. */

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

/** `copy` is the caller's `useCopy(orderDetailContent)`; English when left out. */
export function methodLabel(provider: string, copy = orderDetailContent): string {
  return copy.payment.method[provider] ?? cap(provider)
}

/** Shopify's own gateway codes on imported orders, in words. */
const SHOPIFY_GATEWAYS: Record<string, string> = {
  shopify_store_credit: 'store_credit',
  gift_card: 'gift_card',
  manual: 'other',
  cash_on_delivery: 'cod',
}

/**
 * An imported order's gateways as Shopify named them ("1 Razorpay", "1Cashfree Payments(UPI,
 * Cards,…)", "shopify_store_credit"), cleaned for people: "Razorpay", "Cashfree Payments",
 * "Store credit" (audit #13).
 */
export function importedGatewayLabel(raw: string, copy = orderDetailContent): string {
  return raw
    .split(/,(?![^(]*\))/)
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => {
      const known = SHOPIFY_GATEWAYS[g]
      if (known) return copy.payment.method[known] ?? cap(known)
      return g.replace(/^\d+\s*/, '').replace(/\s*\(.*\)\s*$/, '')
    })
    .join(', ')
}

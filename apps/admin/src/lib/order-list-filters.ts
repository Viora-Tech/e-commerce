import type { OrderFulfillmentStatus, OrderPaymentStatus } from '@commerce/core/order-status'
import { parseAsArrayOf, parseAsStringLiteral } from 'nuqs'
import type { AppliedFilter } from '@/components/table/resource-table/toolbar'
import type { ordersContent } from '@/data/orders'

/** The Orders filter panel (Figma "Orders · Filter"): what a merchant ticks, by group. */
export const PAYMENT_FILTERS = ['paid', 'unpaid', 'partially_refunded', 'refund_needed'] as const
export const FULFILMENT_FILTERS = ['unfulfilled', 'shipped', 'delivered', 'returned'] as const
export const DATE_FILTERS = ['today', '7d', '30d', '90d'] as const
/** Stored payment methods are gateway names, so the panel splits only cash on delivery from prepaid. */
export const METHOD_FILTERS = ['cod', 'prepaid'] as const

export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]
export type FulfilmentFilter = (typeof FULFILMENT_FILTERS)[number]
export type DateFilter = (typeof DATE_FILTERS)[number]
export type MethodFilter = (typeof METHOD_FILTERS)[number]

export type OrderFilters = {
  payment: PaymentFilter[]
  fulfilment: FulfilmentFilter[]
  date: DateFilter | null
  method: MethodFilter[]
}

/* One ticked box can stand for several stored statuses ("Unpaid" includes authorised and part paid). */
const PAYMENT_STATUSES: Record<PaymentFilter, OrderPaymentStatus[]> = {
  paid: ['paid'],
  unpaid: ['unpaid', 'authorized', 'partially_paid'],
  partially_refunded: ['partially_refunded'],
  refund_needed: ['refund_needed'],
}

const FULFILMENT_STATUSES: Record<FulfilmentFilter, OrderFulfillmentStatus[]> = {
  unfulfilled: ['unfulfilled', 'partially_fulfilled'],
  shipped: ['shipped', 'partially_delivered'],
  delivered: ['delivered'],
  returned: ['returned'],
}

const DAYS: Record<Exclude<DateFilter, 'today'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** When the date filter starts: midnight today, or that many days back from now. */
function placedFrom(date: DateFilter, now: Date): string {
  if (date === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }
  return new Date(now.getTime() - DAYS[date] * 86_400_000).toISOString()
}

/** True when any group has something ticked. */
export function hasOrderFilters(f: OrderFilters): boolean {
  return f.payment.length > 0 || f.fulfilment.length > 0 || f.date !== null || f.method.length > 0
}

/** The ticked boxes as `orders.list` input; both payment methods ticked means no method filter. */
export function orderFilterInput(f: OrderFilters, now = new Date()) {
  return {
    ...(f.payment.length ? { paymentStatus: f.payment.flatMap((p) => PAYMENT_STATUSES[p]) } : {}),
    ...(f.fulfilment.length
      ? { fulfillmentStatus: f.fulfilment.flatMap((s) => FULFILMENT_STATUSES[s]) }
      : {}),
    ...(f.date ? { placedFrom: placedFrom(f.date, now) } : {}),
    ...(f.method.length === 1 && f.method[0] ? { paymentMethod: f.method[0] } : {}),
  }
}

/** One chip per filter group (Figma "Applied filters"): "Payment is Unpaid, Paid". */
export function appliedOrderFilters(
  f: OrderFilters,
  copy: (typeof ordersContent)['filters'],
  onChange: (patch: Partial<OrderFilters>) => void,
): AppliedFilter[] {
  return [
    ...(f.payment.length
      ? [
          {
            key: 'payment',
            field: copy.payment,
            label: f.payment.map((p) => copy.paymentOptions[p]).join(', '),
            onRemove: () => onChange({ payment: [] }),
          },
        ]
      : []),
    ...(f.fulfilment.length
      ? [
          {
            key: 'fulfilment',
            field: copy.fulfilment,
            label: f.fulfilment.map((s) => copy.fulfilmentOptions[s]).join(', '),
            onRemove: () => onChange({ fulfilment: [] }),
          },
        ]
      : []),
    ...(f.date
      ? [
          {
            key: 'date',
            field: copy.date,
            label: copy.dateOptions[f.date],
            onRemove: () => onChange({ date: null }),
          },
        ]
      : []),
    ...(f.method.length
      ? [
          {
            key: 'method',
            field: copy.method,
            label: f.method.map((m) => copy.methodOptions[m]).join(', '),
            onRemove: () => onChange({ method: [] }),
          },
        ]
      : []),
  ]
}

export const NO_FILTERS: OrderFilters = { payment: [], fulfilment: [], date: null, method: [] }

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const FILTER_PARAMS = {
  payment: parseAsArrayOf(parseAsStringLiteral(PAYMENT_FILTERS)).withDefault([]),
  fulfilment: parseAsArrayOf(parseAsStringLiteral(FULFILMENT_FILTERS)).withDefault([]),
  date: parseAsStringLiteral(DATE_FILTERS),
  method: parseAsArrayOf(parseAsStringLiteral(METHOD_FILTERS)).withDefault([]),
}

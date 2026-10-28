import type { OrderFulfillmentStatus, OrderPaymentStatus } from '@commerce/core/order-status'
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { ordersContent } from '@/data/orders'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'

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
  /** A preset (`7d`) or a custom from–to (`lib/date-filter.ts`). */
  date: DateFilterValue
  method: MethodFilter[]
  /** A courier id (`delhivery`) the order was sent with; null for any. */
  courier: string | null
  /** Text a line's product title, variant or SKU contains ("pd170"); null for any product. */
  product: string | null
}

/** The longest Product filter the API takes (its `SEARCH_MAX`). */
const PRODUCT_MAX = 200

/** The Product filter as sent: trimmed, and null when only spaces were typed. */
function productText(f: OrderFilters): string | null {
  const text = f.product?.trim().slice(0, PRODUCT_MAX)
  return text ? text : null
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

/** When a date preset starts: midnight today, or that many days back from now. */
function presetStart(preset: string, now: Date): Date | null {
  const date = DATE_FILTERS.find((d) => d === preset)
  if (!date) return null
  if (date === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start
  }
  return new Date(now.getTime() - DAYS[date] * 86_400_000)
}

/** True when any group has something ticked. */
export function hasOrderFilters(f: OrderFilters): boolean {
  return (
    f.payment.length > 0 ||
    f.fulfilment.length > 0 ||
    hasDateFilter(f.date) ||
    f.method.length > 0 ||
    f.courier !== null ||
    productText(f) !== null
  )
}

/** The ticked boxes as `orders.list` input; both payment methods ticked means no method filter. */
export function orderFilterInput(f: OrderFilters, now = new Date()) {
  const product = productText(f)
  const placed = dateFilterBounds(f.date, presetStart, now)
  return {
    ...(product ? { product } : {}),
    ...(f.payment.length ? { paymentStatus: f.payment.flatMap((p) => PAYMENT_STATUSES[p]) } : {}),
    ...(f.fulfilment.length
      ? { fulfillmentStatus: f.fulfilment.flatMap((s) => FULFILMENT_STATUSES[s]) }
      : {}),
    ...(placed.from ? { placedFrom: placed.from } : {}),
    ...(placed.to ? { placedTo: placed.to } : {}),
    ...(f.method.length === 1 && f.method[0] ? { paymentMethod: f.method[0] } : {}),
    ...(f.courier ? { courier: f.courier } : {}),
  }
}

/** A courier id as the panel names it: `delhivery` → `Delhivery`, `blue_dart` → `Blue dart`. */
export const courierName = (id: string) =>
  id.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** Keeps the keys of `all` that were ticked, in `all`'s order, so a tick never reorders the URL. */
function pick<K extends string>(all: readonly K[], ticked: string[]): K[] {
  return all.filter((k) => ticked.includes(k))
}

function options<K extends string>(keys: readonly K[], labels: Record<K, string>) {
  return keys.map((k) => ({ value: k, label: labels[k] }))
}

/** The panel's groups (Figma "Orders · Filter"); the chips and Clear all come from the same list. */
export function orderFilterGroups(
  f: OrderFilters,
  copy: (typeof ordersContent)['filters'],
  onChange: (patch: Partial<OrderFilters>) => void,
  /** The couriers the store's orders went with; the Courier select shows only with some. */
  couriers: readonly string[] = [],
): FilterGroup[] {
  return [
    {
      key: 'product',
      label: copy.product,
      type: 'text',
      value: f.product ?? '',
      onChange: (next) => onChange({ product: next ? next : null }),
      placeholder: copy.productPlaceholder,
    },
    {
      key: 'payment',
      label: copy.payment,
      type: 'checks',
      options: options(PAYMENT_FILTERS, copy.paymentOptions),
      value: f.payment,
      onChange: (next) => onChange({ payment: pick(PAYMENT_FILTERS, next) }),
    },
    {
      key: 'fulfilment',
      label: copy.fulfilment,
      type: 'checks',
      options: options(FULFILMENT_FILTERS, copy.fulfilmentOptions),
      value: f.fulfilment,
      onChange: (next) => onChange({ fulfilment: pick(FULFILMENT_FILTERS, next) }),
    },
    {
      key: 'date',
      label: copy.date,
      type: 'date',
      presets: options(DATE_FILTERS, copy.dateOptions),
      value: f.date,
      onChange: (next) => onChange({ date: next }),
      anyLabel: copy.anyDate,
    },
    {
      key: 'method',
      label: copy.method,
      type: 'checks',
      options: options(METHOD_FILTERS, copy.methodOptions),
      value: f.method,
      onChange: (next) => onChange({ method: pick(METHOD_FILTERS, next) }),
    },
    ...(couriers.length
      ? [
          {
            key: 'courier',
            label: copy.courier,
            type: 'select' as const,
            options: couriers.map((c) => ({ value: c, label: courierName(c) })),
            value: f.courier,
            onChange: (next: string | null) => onChange({ courier: next }),
            anyLabel: copy.anyCourier,
          },
        ]
      : []),
  ]
}

export const NO_FILTERS: OrderFilters = {
  payment: [],
  fulfilment: [],
  date: NO_DATE_FILTER,
  method: [],
  courier: null,
  product: null,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const FILTER_PARAMS = {
  payment: parseAsArrayOf(parseAsStringLiteral(PAYMENT_FILTERS)).withDefault([]),
  fulfilment: parseAsArrayOf(parseAsStringLiteral(FULFILMENT_FILTERS)).withDefault([]),
  date: parseAsDateFilter(DATE_FILTERS),
  method: parseAsArrayOf(parseAsStringLiteral(METHOD_FILTERS)).withDefault([]),
  courier: parseAsString,
  product: parseAsString,
}

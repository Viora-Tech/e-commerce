import { MARKETING_CHANNELS } from '@commerce/core/marketing'
import type { OrderFulfillmentStatus, OrderPaymentStatus } from '@commerce/core/order-status'
import { parseAsArrayOf, parseAsBoolean, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { ReactNode } from 'react'
import {
  type DateFilterValue,
  type FilterGroup,
  facetOptions,
} from '@/components/table/filter-panel'
import type { ordersContent } from '@/data/orders'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import { moneyRangeGroup, paiseBound } from '@/lib/list-filter-groups'
import { hasPick, NO_PICK, pickSignature, pickSummary } from '@/lib/product-filter-selection'

/** The Orders filter panel (Figma "Orders · Filter"): what a merchant ticks, by group. */
export const PAYMENT_FILTERS = [
  'paid',
  'unpaid',
  'payment_pending',
  'partially_refunded',
  'refunded',
  'refund_needed',
] as const
/** `on_hold` is not a stored status: fulfilment held (#1011), sent as its own flag. */
export const FULFILMENT_FILTERS = [
  'unfulfilled',
  'shipped',
  'delivered',
  'returned',
  'on_hold',
] as const
export const DATE_FILTERS = ['today', '7d', '30d', '90d'] as const
/** Stored payment methods are gateway names, so the panel splits only cash on delivery from prepaid. */
export const METHOD_FILTERS = ['cod', 'prepaid'] as const
/** Where the visit came from (`order.attribution`); `untracked` is an order with none recorded. */
export const CHANNEL_FILTERS = [...MARKETING_CHANNELS, 'untracked'] as const
/** Where the order's customer returns stand; `none` is an order nobody asked to return. */
export const RETURN_FILTERS = ['none', 'requested', 'in_progress', 'done', 'declined'] as const

export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]
export type FulfilmentFilter = (typeof FULFILMENT_FILTERS)[number]
export type DateFilter = (typeof DATE_FILTERS)[number]
export type MethodFilter = (typeof METHOD_FILTERS)[number]
export type ChannelFilter = (typeof CHANNEL_FILTERS)[number]
export type ReturnFilter = (typeof RETURN_FILTERS)[number]

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
  /** Any of these tags; arrays below are "any of", empty for no filter. */
  tag: string[]
  channel: ChannelFilter[]
  /** Order value in rupees as typed; empty for no bound. */
  totalMin: string
  totalMax: string
  /** Discount codes, as the facets list them (upper case). */
  discount: string[]
  returns: ReturnFilter[]
  /** Collection ids: orders with a product from any of them (#886). */
  collection: string[]
  /**
   * The Product picker (Shopify's "Product is …"): whole products and single variants. An
   * order matches when a line is one of them, or with `productNot` when none is.
   */
  productIds: string[]
  variantIds: string[]
  productNot: boolean
}

/** What the store's orders use, so the panel lists only values that can match. */
export type OrderFacets = {
  tags: readonly string[]
  discountCodes: readonly string[]
  couriers: readonly string[]
  collections: readonly { id: string; title: string }[]
}

export const NO_ORDER_FACETS: OrderFacets = {
  tags: [],
  discountCodes: [],
  couriers: [],
  collections: [],
}

/** The most products, and separately variants, the API takes (its `PICKED_MAX`). */
export const PICKED_MAX = 100

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Picked ids as sent: a hand-edited URL's junk is dropped so the list still loads. */
const pickedIds = (ids: string[]) => ids.filter((id) => UUID.test(id)).slice(0, PICKED_MAX)

/** The longest Product filter the API takes (its `SEARCH_MAX`). */
const PRODUCT_MAX = 200

/** The Product filter as sent: trimmed, and null when only spaces were typed. */
function productText(f: OrderFilters): string | null {
  const text = f.product?.trim().slice(0, PRODUCT_MAX)
  return text ? text : null
}

/* One ticked box can stand for several stored statuses ("Unpaid" includes authorised and part
   paid; the API counts them on open orders only, like the Unpaid tab). Payment pending is not a
   stored status: it goes as its own flag. */
const PAYMENT_STATUSES: Record<Exclude<PaymentFilter, 'payment_pending'>, OrderPaymentStatus[]> = {
  paid: ['paid'],
  unpaid: ['unpaid', 'authorized', 'partially_paid'],
  partially_refunded: ['partially_refunded'],
  refunded: ['refunded'],
  refund_needed: ['refund_needed'],
}

const FULFILMENT_STATUSES: Record<
  Exclude<FulfilmentFilter, 'on_hold'>,
  OrderFulfillmentStatus[]
> = {
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
    productText(f) !== null ||
    f.tag.length > 0 ||
    f.channel.length > 0 ||
    paiseBound(f.totalMin) !== null ||
    paiseBound(f.totalMax) !== null ||
    f.discount.length > 0 ||
    f.returns.length > 0 ||
    f.collection.length > 0 ||
    hasPick(f)
  )
}

/** The ticked boxes as `orders.list` input; both payment methods ticked means no method filter. */
export function orderFilterInput(f: OrderFilters, now = new Date()) {
  const product = productText(f)
  const productIds = pickedIds(f.productIds)
  const variantIds = pickedIds(f.variantIds)
  const placed = dateFilterBounds(f.date, presetStart, now)
  const min = paiseBound(f.totalMin)
  const max = paiseBound(f.totalMax)
  const paymentStatuses = f.payment.flatMap((p) =>
    p === 'payment_pending' ? [] : PAYMENT_STATUSES[p],
  )
  const fulfillmentStatuses = f.fulfilment.flatMap((s) =>
    s === 'on_hold' ? [] : FULFILMENT_STATUSES[s],
  )
  return {
    ...(product ? { product } : {}),
    ...(paymentStatuses.length ? { paymentStatus: paymentStatuses } : {}),
    ...(f.payment.includes('payment_pending') ? { paymentPending: true } : {}),
    ...(fulfillmentStatuses.length ? { fulfillmentStatus: fulfillmentStatuses } : {}),
    ...(f.fulfilment.includes('on_hold') ? { onHold: true } : {}),
    ...(placed.from ? { placedFrom: placed.from } : {}),
    ...(placed.to ? { placedTo: placed.to } : {}),
    ...(f.method.length === 1 && f.method[0] ? { paymentMethod: f.method[0] } : {}),
    ...(f.courier ? { courier: f.courier } : {}),
    ...(f.tag.length ? { tags: f.tag } : {}),
    ...(f.channel.length ? { channels: f.channel } : {}),
    ...(min !== null ? { totalMinPaise: min } : {}),
    ...(max !== null ? { totalMaxPaise: max } : {}),
    ...(f.discount.length ? { discountCodes: f.discount } : {}),
    ...(f.returns.length ? { returnStatus: f.returns } : {}),
    ...(f.collection.length ? { collectionIds: f.collection } : {}),
    ...(productIds.length ? { productIds } : {}),
    ...(variantIds.length ? { variantIds } : {}),
    ...((productIds.length || variantIds.length) && f.productNot ? { excludeProducts: true } : {}),
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

/** A group that lists the store's own values, left out while the store has none. */
function whenAny(values: readonly unknown[], group: FilterGroup): FilterGroup[] {
  return values.length ? [group] : []
}

/** What the page hands the Product picker group: the names it knows, and the picker itself. */
export type ProductPickerSlot = {
  /** Product ids to titles, variant ids to "Title · Size" (`namesFromRows`). */
  names: ReadonlyMap<string, string>
  control: ReactNode
}

const NO_PICKER: ProductPickerSlot = { names: new Map(), control: null }

/** The panel's groups (Figma "Orders · Filter"); the chips and Clear all come from the same list. */
export function orderFilterGroups(
  f: OrderFilters,
  copy: (typeof ordersContent)['filters'],
  onChange: (patch: Partial<OrderFilters>) => void,
  /** Tags, codes, couriers and collections the store's orders use (`orders.facets`). */
  facets: OrderFacets = NO_ORDER_FACETS,
  /** The Product picker's names and controls (`components/orders/product-filter-picker`). */
  picker: ProductPickerSlot = NO_PICKER,
): FilterGroup[] {
  return [
    {
      key: 'products',
      label: copy.product,
      type: 'picker',
      summary: pickSummary(f, picker.names, copy.picker),
      negated: f.productNot,
      signature: pickSignature(f, f.productNot),
      onClear: () => onChange({ ...NO_PICK, productNot: false }),
      control: picker.control,
    },
    {
      // Free text, kept for links and bookmarks made before the picker (`?product=pd170`).
      key: 'product',
      label: copy.productText,
      type: 'text',
      value: f.product ?? '',
      onChange: (next) => onChange({ product: next ? next : null }),
      placeholder: copy.productPlaceholder,
    },
    ...whenAny(facets.collections, {
      key: 'collection',
      label: copy.collection,
      type: 'multi',
      options: facets.collections.map((c) => ({ value: c.id, label: c.title })),
      value: f.collection,
      onChange: (collection) => onChange({ collection }),
    }),
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
    moneyRangeGroup({
      key: 'total',
      label: copy.total,
      from: f.totalMin,
      to: f.totalMax,
      fromLabel: copy.totalMin,
      toLabel: copy.totalMax,
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { totalMin: from }),
          ...(to === undefined ? {} : { totalMax: to }),
        }),
    }),
    {
      key: 'method',
      label: copy.method,
      type: 'checks',
      options: options(METHOD_FILTERS, copy.methodOptions),
      value: f.method,
      onChange: (next) => onChange({ method: pick(METHOD_FILTERS, next) }),
    },
    {
      key: 'channel',
      label: copy.channel,
      type: 'multi',
      options: options(CHANNEL_FILTERS, copy.channelOptions),
      value: f.channel,
      onChange: (next) => onChange({ channel: pick(CHANNEL_FILTERS, next) }),
    },
    ...whenAny(facets.tags, {
      key: 'tag',
      label: copy.tags,
      type: 'multi',
      options: facetOptions([...facets.tags]),
      value: f.tag,
      onChange: (tag) => onChange({ tag }),
    }),
    ...whenAny(facets.discountCodes, {
      key: 'discount',
      label: copy.discount,
      type: 'multi',
      options: facetOptions([...facets.discountCodes]),
      value: f.discount,
      onChange: (discount) => onChange({ discount }),
    }),
    {
      key: 'returns',
      label: copy.returns,
      type: 'checks',
      options: options(RETURN_FILTERS, copy.returnOptions),
      value: f.returns,
      onChange: (next) => onChange({ returns: pick(RETURN_FILTERS, next) }),
    },
    ...whenAny(facets.couriers, {
      key: 'courier',
      label: copy.courier,
      type: 'select',
      options: facets.couriers.map((c) => ({ value: c, label: courierName(c) })),
      value: f.courier,
      onChange: (next) => onChange({ courier: next }),
      anyLabel: copy.anyCourier,
    }),
  ]
}

export const NO_FILTERS: OrderFilters = {
  payment: [],
  fulfilment: [],
  date: NO_DATE_FILTER,
  method: [],
  courier: null,
  product: null,
  tag: [],
  channel: [],
  totalMin: '',
  totalMax: '',
  discount: [],
  returns: [],
  collection: [],
  productIds: [],
  variantIds: [],
  productNot: false,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change. */
export const FILTER_PARAMS = {
  payment: parseAsArrayOf(parseAsStringLiteral(PAYMENT_FILTERS)).withDefault([]),
  fulfilment: parseAsArrayOf(parseAsStringLiteral(FULFILMENT_FILTERS)).withDefault([]),
  date: parseAsDateFilter(DATE_FILTERS),
  method: parseAsArrayOf(parseAsStringLiteral(METHOD_FILTERS)).withDefault([]),
  courier: parseAsString,
  product: parseAsString,
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  channel: parseAsArrayOf(parseAsStringLiteral(CHANNEL_FILTERS)).withDefault([]),
  totalMin: parseAsString.withDefault(''),
  totalMax: parseAsString.withDefault(''),
  discount: parseAsArrayOf(parseAsString).withDefault([]),
  returns: parseAsArrayOf(parseAsStringLiteral(RETURN_FILTERS)).withDefault([]),
  collection: parseAsArrayOf(parseAsString).withDefault([]),
  productIds: parseAsArrayOf(parseAsString).withDefault([]),
  variantIds: parseAsArrayOf(parseAsString).withDefault([]),
  productNot: parseAsBoolean.withDefault(false),
}

import {
  type OrderFulfillmentStatus,
  type OrderPaymentStatus,
  type OrderStatus,
  UNPAID_PAYMENT_STATUSES,
} from '@commerce/core'
import { MARKETING_CHANNELS } from '@commerce/core/marketing'
import type { StoreTx } from '@commerce/db'
import {
  address,
  collection,
  collectionProduct,
  customer,
  fulfillmentOrder,
  order,
  orderLine,
  returnRequest,
  shipment,
  variant,
} from '@commerce/db'
import {
  and,
  asc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { type OrderView, paymentFinished, paymentNotFinished, viewFilter } from './order-views'

/* The Orders list's where clause and the filter panel's options, shared by the list and its ids. */

/** Drafts live in the same table but are not orders yet; every list and tile hides them. */
export const notDraft = ne(order.status, 'draft')

/** Fulfilment on hold (#1011): a parcel still to ship is held (staff or an automation). */
export const onHoldSql = sql<boolean>`exists (select 1 from ${fulfillmentOrder} where ${fulfillmentOrder.orderId} = ${order.id} and ${fulfillmentOrder.heldAt} is not null and ${fulfillmentOrder.status} in ('open', 'on_hold'))`

/** "#1234" or "1234" is an order number; anything else is a name or an email. */
export function orderNumberFromSearch(search: string): number | null {
  const match = /^#?(\d{1,9})$/.exec(search.trim())
  return match ? Number(match[1]) : null
}

/** The Orders list's filters (search, view and the filter panel), shared by the list and its ids. */
export type OrderListFilters = {
  search?: string | undefined
  view?: OrderView | undefined
  status?: OrderStatus | undefined
  paymentStatus?: OrderPaymentStatus[] | undefined
  /** Money is expected but not in yet: an online payment not finished, or a UPI transfer to match. */
  paymentPending?: boolean | undefined
  fulfillmentStatus?: OrderFulfillmentStatus[] | undefined
  /** Only orders whose fulfilment is on hold (the Fulfilment filter's "On hold"). */
  onHold?: boolean | undefined
  placedFrom?: string | undefined
  /** Placed before this time (the end of a custom date range). */
  placedTo?: string | undefined
  paymentMethod?: 'cod' | 'prepaid' | undefined
  /** Has a consignment with this courier (`shipment.provider`). */
  courier?: string | undefined
  /** Has a line whose product title, variant title or SKU contains this ("pd170"). */
  product?: string | undefined
  /** Carries any of these tags. */
  tags?: string[] | undefined
  /** Came from any of these channels (`attribution.channel`; `untracked` when none was recorded). */
  channels?: OrderChannelFilter[] | undefined
  totalMinPaise?: number | undefined
  totalMaxPaise?: number | undefined
  /** Used any of these discount codes, compared without case. */
  discountCodes?: string[] | undefined
  /** Where its customer returns stand (RTO parcels are the Returned fulfilment, not this). */
  returnStatus?: OrderReturnFilter[] | undefined
  /** Has a line whose product sits in any of these collections. */
  collectionIds?: string[] | undefined
}

/** The Channel filter: the marketing channels, plus orders placed with no attribution. */
export const ORDER_CHANNEL_FILTERS = [...MARKETING_CHANNELS, 'untracked'] as const
export type OrderChannelFilter = (typeof ORDER_CHANNEL_FILTERS)[number]

/** The Return status filter, by the order's customer returns (`return_request.kind = 'return'`). */
export const ORDER_RETURN_FILTERS = [
  'none',
  'requested',
  'in_progress',
  'done',
  'declined',
] as const
export type OrderReturnFilter = (typeof ORDER_RETURN_FILTERS)[number]

const RETURN_FILTER_STATUSES: Record<Exclude<OrderReturnFilter, 'none'>, string[]> = {
  requested: ['requested'],
  in_progress: ['approved', 'in_transit', 'received'],
  done: ['resolved'],
  declined: ['rejected', 'cancelled'],
}

/** Any of the ticked return states: "no return" or a return in one of the statuses. */
function returnStatusWhere(picked: OrderReturnFilter[]) {
  const statuses = picked.flatMap((p) => (p === 'none' ? [] : RETURN_FILTER_STATUSES[p]))
  const hasReturn = (extra: ReturnType<typeof sql> | undefined) =>
    sql`exists (select 1 from ${returnRequest} rr where rr.order_id = ${order.id} and rr.kind = 'return'${extra ?? sql``})`
  return or(
    picked.includes('none') ? sql`not ${hasReturn(undefined)}` : undefined,
    statuses.length
      ? hasReturn(sql` and rr.status = any(${sql.param(statuses)}::text[])`)
      : undefined,
  )
}

/** Any of the ticked channels; `untracked` is an order with no channel recorded. */
function channelWhere(picked: OrderChannelFilter[]) {
  const channel = sql`${order.attribution}->>'channel'`
  const named = picked.filter((c) => c !== 'untracked')
  return or(
    picked.includes('untracked') ? sql`${channel} is null` : undefined,
    named.length ? sql`${channel} = any(${sql.param(named)}::text[])` : undefined,
  )
}

/** The Collection filter (#886): a line's product is in one of the collections. */
function inCollections(ids: string[]) {
  return sql`exists (
    select 1 from ${orderLine} ol
    join ${variant} v on v.id = ol.variant_id
    join ${collectionProduct} cp on cp.product_id = v.product_id
    where ol.order_id = ${order.id} and cp.collection_id = any(${sql.param(ids)}::uuid[]))`
}

/** `%`, `_` and `\` typed into a filter match themselves, not as LIKE wildcards. */
const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`)

/** The Product filter: a line of the order is this product (title as sold, or the variant's SKU). */
function hasProductLine(text: string) {
  const pattern = `%${escapeLike(text)}%`
  return sql`exists (
    select 1 from ${orderLine} ol
    left join ${variant} v on v.id = ol.variant_id
    where ol.order_id = ${order.id}
      and (ol.title ilike ${pattern} or ol.variant_title ilike ${pattern} or v.sku ilike ${pattern}))`
}

/**
 * The search box beyond email and customer name: the phone (digits only, so "+91 79774 37620"
 * finds "7977437620"), the shipping address's name, city or PIN code, and the products sold
 * (title, variant or SKU). Indian merchants look orders up by phone and city first (audit #44).
 */
function searchesOrderDetails(text: string) {
  const pattern = `%${escapeLike(text.trim())}%`
  const digits = text.replace(/\D/g, '')
  // Six digits or more is a phone fragment; shorter numbers are PIN codes or order numbers.
  const phoneLike = digits.length >= 6 ? `%${digits}%` : null
  const addressPhone = phoneLike
    ? sql`regexp_replace(a.phone, '\\D', '', 'g') like ${phoneLike}`
    : sql`false`
  return or(
    sql`exists (
      select 1 from ${address} a
      where a.id = ${order.shippingAddressId}
        and (a.name ilike ${pattern} or a.city ilike ${pattern} or a.pincode ilike ${pattern} or ${addressPhone}))`,
    phoneLike
      ? sql`regexp_replace(coalesce(${order.phone}, ''), '\\D', '', 'g') like ${phoneLike}`
      : undefined,
    hasProductLine(text.trim()),
  )
}

/** Every condition of the Orders list: tab, search and the filter panel. */
/**
 * The filter panel's Payment boxes, any of them (#2, #11). An unpaid status counts the way the
 * Unpaid tab does: open orders whose checkout finished, so a cancelled one (shown as Voided) or a
 * checkout still at the gateway never makes the filter disagree with the tab. Payment pending is
 * money on its way: an online payment not finished yet, or a manual UPI transfer to match.
 */
function paymentWhere(statuses: OrderPaymentStatus[], pending: boolean) {
  if (statuses.length === 0 && !pending) return undefined
  const unpaid = statuses.filter((s) => UNPAID_PAYMENT_STATUSES.includes(s))
  const settled = statuses.filter((s) => !UNPAID_PAYMENT_STATUSES.includes(s))
  return or(
    settled.length ? inArray(order.paymentStatus, settled) : undefined,
    unpaid.length
      ? and(eq(order.status, 'open'), inArray(order.paymentStatus, unpaid), paymentFinished)
      : undefined,
    pending
      ? and(
          eq(order.status, 'open'),
          or(
            paymentNotFinished,
            and(
              isNull(order.checkoutPaidAt),
              eq(order.paymentMethod, 'manual'),
              isNull(order.importedFrom),
            ),
          ),
        )
      : undefined,
  )
}

export function orderListWhere(input: OrderListFilters) {
  const byNumber = input.search ? orderNumberFromSearch(input.search) : null
  return and(
    notDraft,
    // A search finds any order, a checkout still waiting on payment too.
    input.view ? viewFilter(input.view) : input.search ? undefined : viewFilter('all'),
    input.search
      ? or(
          ilike(order.email, `%${input.search}%`),
          ilike(customer.name, `%${input.search}%`),
          byNumber === null ? undefined : eq(order.number, byNumber),
          searchesOrderDetails(input.search),
        )
      : undefined,
    input.status ? eq(order.status, input.status) : undefined,
    paymentWhere(input.paymentStatus ?? [], input.paymentPending ?? false),
    input.fulfillmentStatus?.length
      ? inArray(order.fulfillmentStatus, input.fulfillmentStatus)
      : undefined,
    input.onHold ? onHoldSql : undefined,
    input.placedFrom ? gte(order.placedAt, new Date(input.placedFrom)) : undefined,
    input.placedTo ? lt(order.placedAt, new Date(input.placedTo)) : undefined,
    /* An order with no recorded method (imported history) is neither. */
    input.paymentMethod === 'cod'
      ? eq(order.paymentMethod, 'cod')
      : input.paymentMethod === 'prepaid'
        ? ne(order.paymentMethod, 'cod')
        : undefined,
    input.courier
      ? sql`exists (select 1 from ${shipment} s where s.order_id = ${order.id} and s.provider = ${input.courier})`
      : undefined,
    input.product ? hasProductLine(input.product) : undefined,
    input.tags?.length ? sql`${order.tags} && ${sql.param(input.tags)}::text[]` : undefined,
    input.channels?.length ? channelWhere(input.channels) : undefined,
    input.totalMinPaise !== undefined ? gte(order.totalPaise, input.totalMinPaise) : undefined,
    input.totalMaxPaise !== undefined ? lte(order.totalPaise, input.totalMaxPaise) : undefined,
    input.discountCodes?.length
      ? sql`upper(${order.discountCode}) = any(${sql.param(input.discountCodes.map((c) => c.toUpperCase()))}::text[])`
      : undefined,
    input.returnStatus?.length ? returnStatusWhere(input.returnStatus) : undefined,
    input.collectionIds?.length ? inCollections(input.collectionIds) : undefined,
  )
}

/** The couriers this store's orders went with, for the filter panel's Courier select. */
export async function orderCouriers(tx: StoreTx): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ provider: shipment.provider })
    .from(shipment)
    .orderBy(shipment.provider)
  return rows.map((r) => r.provider)
}

/** The most tags or codes the panel lists; a store with more finds them by typing. */
const FACET_MAX = 500

/** What the Orders filter panel offers: tags and discount codes on placed orders, couriers, collections. */
export async function orderFacets(tx: StoreTx) {
  const [tags, codes, couriers, collections] = await Promise.all([
    tx
      .selectDistinct({ tag: sql<string>`unnest(${order.tags})` })
      .from(order)
      .where(notDraft)
      .orderBy(sql`1`)
      .limit(FACET_MAX),
    tx
      .selectDistinct({ code: sql<string>`upper(${order.discountCode})` })
      .from(order)
      .where(and(notDraft, isNotNull(order.discountCode)))
      .orderBy(sql`1`)
      .limit(FACET_MAX),
    orderCouriers(tx),
    tx
      .select({ id: collection.id, title: collection.title })
      .from(collection)
      .orderBy(asc(collection.title)),
  ])
  return {
    tags: tags.map((r) => r.tag),
    discountCodes: codes.map((r) => r.code),
    couriers,
    collections,
  }
}

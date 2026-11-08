/** SOURCE OF TRUTH: the draft orders list — WHAT: listDrafts with its tabs (DRAFT_LIST_STATUSES), search and filters / WHY: split out of drafts.ts; the admin's Drafts page reads it */
import { customer, order, orderLine } from '@commerce/db'
import { and, desc, eq, gte, isNull, lt, lte, or, type SQL, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { parseDraftSearch } from './draft-ref'
import type { DraftListItem } from './drafts'

/** The drafts list's tabs after "All" (`?status=`). */
export const DRAFT_LIST_STATUSES = ['open', 'invoice_sent'] as const
export type DraftListStatus = (typeof DRAFT_LIST_STATUSES)[number]

/** The Drafts page's tabs by who made the draft: the shopper's unpaid checkout, or staff. */
export const DRAFT_SOURCES = ['checkout', 'staff'] as const
export type DraftSource = (typeof DRAFT_SOURCES)[number]

/** A captured payment the draft could not keep (late capture, out of stock). */
const refundNeeded = sql<boolean>`exists (
  select 1 from payment p where p.order_id = ${order.id} and p.refund_needed)`

/**
 * Who made it. Checkout drafts show while they wait for payment (7 days from their last
 * activity) and after, while money on one needs refunding; staff drafts always show.
 */
function sourceWhere(source: DraftSource | undefined): SQL | undefined {
  const visibleCheckout = and(
    eq(order.draftSource, 'checkout'),
    or(isNull(order.draftExpiredAt), refundNeeded),
  )
  if (source === 'checkout') return visibleCheckout
  const staff = sql`${order.draftSource} is distinct from 'checkout'`
  if (source === 'staff') return staff
  return or(staff, visibleCheckout)
}

/** The drafts list's filter panel: created window and total, both ends optional. */
export type DraftListFilters = {
  search?: string | undefined
  status?: DraftListStatus | undefined
  source?: DraftSource | undefined
  createdFrom?: string | undefined
  /** Created before this time (the end of a custom date range). */
  createdTo?: string | undefined
  totalMinPaise?: number | undefined
  totalMaxPaise?: number | undefined
}

export async function listDrafts(
  ctx: StoreContext,
  input: DraftListFilters & { page: number; perPage: number },
): Promise<{ items: DraftListItem[]; total: number }> {
  const search = input.search?.trim()
  /* "D12" or "#D12" finds that draft; anything else matches emails, names and numbers. */
  const draftSearch = search ? parseDraftSearch(search) : null
  const numberSearch = search?.replace(/^#/, '')
  const invoiceSent = sql`exists (
    select 1 from notification n
    where n.order_id = ${order.id} and n.template = 'draft_invoice' and n.status = 'sent')`
  const where = and(
    eq(order.status, 'draft'),
    sourceWhere(input.source),
    input.status === 'open' ? sql`not ${invoiceSent}` : undefined,
    input.status === 'invoice_sent' ? invoiceSent : undefined,
    draftSearch !== null
      ? eq(order.draftNumber, draftSearch)
      : search
        ? sql`(${order.email} ilike ${`%${search}%`} or ${customer.name} ilike ${`%${search}%`} or (${order.number} > 0 and cast(${order.number} as text) like ${`%${numberSearch}%`}) or cast(${order.draftNumber} as text) like ${`%${numberSearch}%`})`
        : undefined,
    /* A draft's creation time is kept in placed_at until it converts. */
    input.createdFrom ? gte(order.placedAt, new Date(input.createdFrom)) : undefined,
    input.createdTo ? lt(order.placedAt, new Date(input.createdTo)) : undefined,
    input.totalMinPaise !== undefined ? gte(order.totalPaise, input.totalMinPaise) : undefined,
    input.totalMaxPaise !== undefined ? lte(order.totalPaise, input.totalMaxPaise) : undefined,
  )
  const [countRow] = await ctx.tx
    .select({ total: sql<number>`count(*)::int` })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
  const items = await ctx.tx
    .select({
      id: order.id,
      draftNumber: order.draftNumber,
      number: order.number,
      customerName: customer.name,
      email: order.email,
      totalPaise: order.totalPaise,
      createdAt: order.placedAt,
      lineCount: sql<number>`(select coalesce(sum(ol.quantity), 0)::int from ${orderLine} ol where ol.order_id = ${order.id})`,
      invoiceSentAt: sql<Date | null>`(
        select max(n.created_at) from notification n
        where n.order_id = ${order.id} and n.template = 'draft_invoice' and n.status = 'sent')`,
      source: sql<DraftSource>`case when ${order.draftSource} = 'checkout' then 'checkout' else 'staff' end`,
      paymentMethod: order.paymentMethod,
      lastActivityAt: order.lastActivityAt,
      lastAttemptStatus: sql<string | null>`(
        select p.status from payment p where p.order_id = ${order.id}
        and p.provider not in ('gift_card', 'store_credit')
        order by p.attempt desc, p.id desc limit 1)`,
      lastAttemptError: sql<string | null>`(
        select p.error from payment p where p.order_id = ${order.id}
        and p.provider not in ('gift_card', 'store_credit')
        order by p.attempt desc, p.id desc limit 1)`,
      failedAttempts: sql<number>`(
        select count(*)::int from payment p where p.order_id = ${order.id} and p.status = 'failed')`,
      refundNeeded,
      reservedUntil: order.reservedUntil,
      expiredAt: order.draftExpiredAt,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
    // Newest activity first: a checkout draft the shopper came back to moves to the top.
    .orderBy(desc(sql`coalesce(${order.lastActivityAt}, ${order.placedAt})`), desc(order.id))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
}

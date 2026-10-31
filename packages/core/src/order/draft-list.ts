/** SOURCE OF TRUTH: the draft orders list — WHAT: listDrafts with its tabs (DRAFT_LIST_STATUSES), search and filters / WHY: split out of drafts.ts; the admin's Drafts page reads it */
import { customer, order, orderLine } from '@commerce/db'
import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { parseDraftSearch } from './draft-ref'
import type { DraftListItem } from './drafts'

/** The drafts list's tabs after "All" (`?status=`). */
export const DRAFT_LIST_STATUSES = ['open', 'invoice_sent'] as const
export type DraftListStatus = (typeof DRAFT_LIST_STATUSES)[number]

/** The drafts list's filter panel: created window and total, both ends optional. */
export type DraftListFilters = {
  search?: string | undefined
  status?: DraftListStatus | undefined
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
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(where)
    .orderBy(desc(order.placedAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
}

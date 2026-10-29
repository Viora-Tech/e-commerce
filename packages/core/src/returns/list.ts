/** SOURCE OF TRUTH: the admin Returns list — WHAT: return requests a page at a time by tab, search and the filter panel (reason, outcome, asked on), and the tab counts / WHY: the Returns page and its counts read one query, split from service.ts which owns every state change */
import { customer, order, orderLine, returnRequest, returnRequestLine } from '@commerce/db'
import { and, count, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type ReturnReason, type ReturnResolution, type ReturnStatus, returnLabel } from './policy'

export type ReturnListFilter = {
  page?: number | undefined
  perPage?: number | undefined
  status?: ReturnStatus[] | undefined
  kind?: 'return' | 'rto' | undefined
  search?: string | undefined
  /** The filter panel: why it came back, how it was settled, when it was asked for. */
  reasons?: ReturnReason[] | undefined
  resolutions?: ReturnResolution[] | undefined
  requestedFrom?: string | undefined
  requestedTo?: string | undefined
}

/** The admin Returns list: newest first, with the order and customer it belongs to. */
export async function listReturns(ctx: StoreContext, filter: ReturnListFilter = {}) {
  const page = Math.max(1, filter.page ?? 1)
  const perPage = Math.min(100, Math.max(1, filter.perPage ?? 25))
  const conds = [eq(returnRequest.storeId, ctx.storeId)]
  if (filter.status?.length) conds.push(inArray(returnRequest.status, filter.status))
  if (filter.kind) conds.push(eq(returnRequest.kind, filter.kind))
  if (filter.reasons?.length) conds.push(inArray(returnRequest.reason, filter.reasons))
  if (filter.resolutions?.length) conds.push(inArray(returnRequest.resolution, filter.resolutions))
  if (filter.requestedFrom)
    conds.push(gte(returnRequest.requestedAt, new Date(filter.requestedFrom)))
  if (filter.requestedTo) conds.push(lt(returnRequest.requestedAt, new Date(filter.requestedTo)))
  const q = filter.search?.trim().replace(/^#|^r-/i, '')
  if (q) {
    const n = Number(q)
    const text = `%${q}%`
    const match = or(
      ilike(order.email, text),
      ilike(customer.name, text),
      ...(Number.isInteger(n) && n > 0 ? [eq(order.number, n), eq(returnRequest.number, n)] : []),
    )
    if (match) conds.push(match)
  }
  const where = and(...conds)
  const [rows, [total]] = await Promise.all([
    ctx.tx
      .select({
        id: returnRequest.id,
        number: returnRequest.number,
        kind: returnRequest.kind,
        status: returnRequest.status,
        resolution: returnRequest.resolution,
        reason: returnRequest.reason,
        requestedAt: returnRequest.requestedAt,
        orderId: order.id,
        orderNumber: order.number,
        email: order.email,
        customerName: customer.name,
        items: sql<number>`(select coalesce(sum(${returnRequestLine.quantity}), 0)::int from ${returnRequestLine} where ${returnRequestLine.returnRequestId} = ${returnRequest.id})`,
        valuePaise: sql<number>`(select coalesce(sum(${returnRequestLine.quantity} * ${orderLine.unitPricePaise}), 0)::int from ${returnRequestLine} join ${orderLine} on ${orderLine.id} = ${returnRequestLine.orderLineId} where ${returnRequestLine.returnRequestId} = ${returnRequest.id})`,
      })
      .from(returnRequest)
      .innerJoin(order, eq(order.id, returnRequest.orderId))
      .leftJoin(customer, eq(customer.id, order.customerId))
      .where(where)
      .orderBy(desc(returnRequest.requestedAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    ctx.tx
      .select({ n: count() })
      .from(returnRequest)
      .innerJoin(order, eq(order.id, returnRequest.orderId))
      .leftJoin(customer, eq(customer.id, order.customerId))
      .where(where),
  ])
  return {
    items: rows.map((r) => ({
      ...r,
      label: returnLabel(r.number),
      items: Number(r.items),
      valuePaise: Number(r.valuePaise),
    })),
    total: Number(total?.n ?? 0),
    page,
    perPage,
  }
}

/** Counts for the Returns tabs. */
export async function returnCounts(ctx: StoreContext) {
  const rows = await ctx.tx
    .select({ status: returnRequest.status, kind: returnRequest.kind, n: count() })
    .from(returnRequest)
    .where(eq(returnRequest.storeId, ctx.storeId))
    .groupBy(returnRequest.status, returnRequest.kind)
  const sum = (pred: (r: (typeof rows)[number]) => boolean) =>
    rows.filter(pred).reduce((s, r) => s + Number(r.n), 0)
  return {
    all: sum(() => true),
    requested: sum((r) => r.status === 'requested'),
    inProgress: sum((r) => r.status === 'approved' || r.status === 'in_transit'),
    received: sum((r) => r.status === 'received'),
    rto: sum((r) => r.kind === 'rto'),
    /** RTO parcels back with the merchant, waiting for restock and a refund or re-ship. */
    rtoOpen: sum((r) => r.kind === 'rto' && r.status === 'received'),
  }
}

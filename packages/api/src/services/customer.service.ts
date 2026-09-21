import type { StoreTx } from '@commerce/db'
import { customer, notification, order } from '@commerce/db'
import { and, asc, count, desc, eq, gte, ilike, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

const DAY_MS = 86_400_000
const STATS_WINDOW_DAYS = 7

export type CustomerSegment = 'new' | 'returning'
export type CustomerSort = 'recent' | 'name' | 'orders' | 'spent'

export type CustomerListItem = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  tags: string[]
  acceptsMarketing: boolean
  orderCount: number
  spentPaise: number
  lastOrderAt: Date | null
  createdAt: Date
}

export type CustomerStats = {
  total: number
  newThisWeek: number
  returning: number
  marketing: number
}

/**
 * Outer table gets an explicit alias and the subqueries name it literally:
 * in a single-table select Drizzle renders `${c.id}` as a bare "id", which
 * Postgres would resolve against the inner `o`.
 */
const c = alias(customer, 'c')

/** Per-customer totals; cancelled orders never count towards spend. */
const orderCountSql = sql<number>`(
  select count(*)::int from ${order} o where o.customer_id = c.id)`
const spentSql = sql<number>`(
  select coalesce(sum(o.total_paise), 0)::int from ${order} o
  where o.customer_id = c.id and o.status <> 'cancelled')`
const lastOrderSql = sql<Date | null>`(
  select max(o.placed_at) from ${order} o where o.customer_id = c.id)`

export async function listCustomers(
  tx: StoreTx,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    segment?: CustomerSegment | undefined
    sort?: CustomerSort | undefined
  },
  now = new Date(),
) {
  const weekAgo = new Date(now.getTime() - STATS_WINDOW_DAYS * DAY_MS)
  const where = and(
    input.search
      ? or(
          ilike(c.name, `%${input.search}%`),
          ilike(c.email, `%${input.search}%`),
          ilike(c.phone, `%${input.search}%`),
        )
      : undefined,
    input.segment === 'new' ? gte(c.createdAt, weekAgo) : undefined,
    input.segment === 'returning' ? sql`${orderCountSql} > 1` : undefined,
  )
  const orderBy = {
    recent: [desc(c.createdAt)],
    name: [asc(c.name), asc(c.email)],
    orders: [desc(orderCountSql), desc(c.createdAt)],
    spent: [desc(spentSql), desc(c.createdAt)],
  }[input.sort ?? 'recent']
  const [countRow] = await tx.select({ total: count() }).from(c).where(where)
  const items: CustomerListItem[] = await tx
    .select({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      tags: c.tags,
      acceptsMarketing: c.acceptsMarketing,
      orderCount: orderCountSql,
      spentPaise: spentSql,
      lastOrderAt: lastOrderSql,
      createdAt: c.createdAt,
    })
    .from(c)
    .where(where)
    .orderBy(...orderBy)
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
}

export async function customerStats(tx: StoreTx, now = new Date()): Promise<CustomerStats> {
  const weekAgo = new Date(now.getTime() - STATS_WINDOW_DAYS * DAY_MS)
  const [row] = await tx
    .select({
      total: count(),
      newThisWeek: sql<number>`count(*) filter (where ${c.createdAt} >= ${weekAgo.toISOString()}::timestamptz)::int`,
      returning: sql<number>`count(*) filter (where ${orderCountSql} > 1)::int`,
      marketing: sql<number>`count(*) filter (where ${c.acceptsMarketing})::int`,
    })
    .from(c)
  return {
    total: row?.total ?? 0,
    newThisWeek: row?.newThisWeek ?? 0,
    returning: row?.returning ?? 0,
    marketing: row?.marketing ?? 0,
  }
}

export async function getCustomer(tx: StoreTx, id: string) {
  const [c] = await tx.select().from(customer).where(eq(customer.id, id))
  if (!c) return null
  const [orders, sent] = await Promise.all([
    tx
      .select({
        id: order.id,
        number: order.number,
        status: order.status,
        paymentMethod: order.paymentMethod,
        totalPaise: order.totalPaise,
        placedAt: order.placedAt,
      })
      .from(order)
      .where(eq(order.customerId, id))
      .orderBy(desc(order.placedAt)),
    c.email
      ? tx
          .select({
            id: notification.id,
            channel: notification.channel,
            template: notification.template,
            status: notification.status,
            orderId: notification.orderId,
            createdAt: notification.createdAt,
          })
          .from(notification)
          .where(eq(notification.to, c.email))
          .orderBy(desc(notification.createdAt))
          .limit(50)
      : Promise.resolve([]),
  ])
  const live = orders.filter((o) => o.status !== 'cancelled')
  return {
    ...c,
    orders,
    notifications: sent,
    totals: {
      orderCount: orders.length,
      spentPaise: live.reduce((sum, o) => sum + o.totalPaise, 0),
      lastOrderAt: orders[0]?.placedAt ?? null,
    },
  }
}

export async function updateCustomer(
  tx: StoreTx,
  id: string,
  patch: {
    name?: string | null | undefined
    phone?: string | null | undefined
    tags?: string[] | undefined
    note?: string | null | undefined
    acceptsMarketing?: boolean | undefined
  },
) {
  const [row] = await tx
    .update(customer)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(customer.id, id))
    .returning()
  return row ?? null
}

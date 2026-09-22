import { evaluateSegment, type SegmentCustomer } from '@commerce/core'
import type { CustomerSegmentRules, StoreTx } from '@commerce/db'
import { customer, customerSegment, notification, order } from '@commerce/db'
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

const DAY_MS = 86_400_000
const RECENT_WINDOW_DAYS = 30

export type CustomerSegmentName = 'new' | 'returning' | 'subscribed'
export type CustomerSort = 'recent' | 'name' | 'orders' | 'spent'

export type CustomerFilters = {
  /** Two-letter state code from the default address. */
  stateCode?: string | undefined
  minSpentPaise?: number | undefined
  maxSpentPaise?: number | undefined
  minOrders?: number | undefined
  acceptsMarketing?: boolean | undefined
  tag?: string | undefined
}

export type CustomerQuery = {
  search?: string | undefined
  segment?: CustomerSegmentName | undefined
} & CustomerFilters

export type CustomerListItem = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  stateCode: string | null
  tags: string[]
  acceptsMarketing: boolean
  orderCount: number
  spentPaise: number
  lastOrderAt: Date | null
  createdAt: Date
}

export type CustomerStats = {
  total: number
  newThisMonth: number
  returning: number
  marketing: number
  averageLifetimePaise: number
}

/**
 * Outer table gets an explicit alias and the subqueries name it literally:
 * in a single-table select Drizzle renders `${c.id}` as a bare "id", which
 * Postgres would resolve against the inner `o`.
 */
const c = alias(customer, 'c')

/** Per-customer totals; drafts never count, and cancelled orders never count towards spend. */
const orderCountSql = sql<number>`(
  select count(*)::int from ${order} o where o.customer_id = c.id and o.status <> 'draft')`
const spentSql = sql<number>`(
  select coalesce(sum(o.total_paise), 0)::int from ${order} o
  where o.customer_id = c.id and o.status not in ('cancelled', 'draft'))`
const lastOrderSql = sql<Date | null>`(
  select max(o.placed_at) from ${order} o where o.customer_id = c.id and o.status <> 'draft')`
const citySql = sql<string | null>`(${c.defaultAddress} ->> 'city')`
const stateSql = sql<string | null>`(${c.defaultAddress} ->> 'stateCode')`

const SELECTION = {
  id: c.id,
  name: c.name,
  email: c.email,
  phone: c.phone,
  city: citySql,
  stateCode: stateSql,
  tags: c.tags,
  acceptsMarketing: c.acceptsMarketing,
  orderCount: orderCountSql,
  spentPaise: spentSql,
  lastOrderAt: lastOrderSql,
  createdAt: c.createdAt,
}

function filterWhere(input: CustomerQuery, now: Date) {
  const monthAgo = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS)
  return and(
    input.search
      ? or(
          ilike(c.name, `%${input.search}%`),
          ilike(c.email, `%${input.search}%`),
          ilike(c.phone, `%${input.search}%`),
        )
      : undefined,
    input.segment === 'new' ? gte(c.createdAt, monthAgo) : undefined,
    input.segment === 'returning' ? sql`${orderCountSql} > 1` : undefined,
    input.segment === 'subscribed' ? eq(c.acceptsMarketing, true) : undefined,
    input.stateCode ? sql`upper(${stateSql}) = ${input.stateCode.toUpperCase()}` : undefined,
    input.minSpentPaise !== undefined ? sql`${spentSql} >= ${input.minSpentPaise}` : undefined,
    input.maxSpentPaise !== undefined ? sql`${spentSql} <= ${input.maxSpentPaise}` : undefined,
    input.minOrders !== undefined ? sql`${orderCountSql} >= ${input.minOrders}` : undefined,
    input.acceptsMarketing !== undefined
      ? eq(c.acceptsMarketing, input.acceptsMarketing)
      : undefined,
    input.tag ? sql`${c.tags} @> array[${input.tag}]::text[]` : undefined,
  )
}

function toSegmentCustomer(item: CustomerListItem): SegmentCustomer {
  return {
    spentPaise: item.spentPaise,
    orderCount: item.orderCount,
    stateCode: item.stateCode,
    tags: item.tags,
    lastOrderAt: item.lastOrderAt,
    acceptsMarketing: item.acceptsMarketing,
  }
}

export async function listCustomers(
  tx: StoreTx,
  input: { page: number; perPage: number; sort?: CustomerSort | undefined } & CustomerQuery,
  now = new Date(),
) {
  const where = filterWhere(input, now)
  const orderBy = {
    recent: [desc(c.createdAt)],
    name: [asc(c.name), asc(c.email)],
    orders: [desc(orderCountSql), desc(c.createdAt)],
    spent: [desc(spentSql), desc(c.createdAt)],
  }[input.sort ?? 'recent']
  const [countRow] = await tx.select({ total: count() }).from(c).where(where)
  const items: CustomerListItem[] = await tx
    .select(SELECTION)
    .from(c)
    .where(where)
    .orderBy(...orderBy)
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return { items, total: countRow?.total ?? 0 }
}

export async function customerStats(tx: StoreTx, now = new Date()): Promise<CustomerStats> {
  const monthAgo = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS)
  const [row] = await tx
    .select({
      total: count(),
      newThisMonth: sql<number>`count(*) filter (where ${c.createdAt} >= ${monthAgo.toISOString()}::timestamptz)::int`,
      returning: sql<number>`count(*) filter (where ${orderCountSql} > 1)::int`,
      marketing: sql<number>`count(*) filter (where ${c.acceptsMarketing})::int`,
      averageLifetimePaise: sql<number>`coalesce(round(avg(${spentSql})), 0)::int`,
    })
    .from(c)
  return {
    total: row?.total ?? 0,
    newThisMonth: row?.newThisMonth ?? 0,
    returning: row?.returning ?? 0,
    marketing: row?.marketing ?? 0,
    averageLifetimePaise: row?.averageLifetimePaise ?? 0,
  }
}

/** Every customer matching the current filter, for CSV export and segment previews. */
export async function listAllCustomers(
  tx: StoreTx,
  input: CustomerQuery,
  now = new Date(),
): Promise<CustomerListItem[]> {
  return tx.select(SELECTION).from(c).where(filterWhere(input, now)).orderBy(desc(c.createdAt))
}

export async function getCustomer(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(customer).where(eq(customer.id, id))
  if (!row) return null
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
      .where(and(eq(order.customerId, id), sql`${order.status} <> 'draft'`))
      .orderBy(desc(order.placedAt)),
    row.email
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
          .where(eq(notification.to, row.email))
          .orderBy(desc(notification.createdAt))
          .limit(50)
      : Promise.resolve([]),
  ])
  const live = orders.filter((o) => o.status !== 'cancelled')
  const spentPaise = live.reduce((sum, o) => sum + o.totalPaise, 0)
  return {
    ...row,
    orders,
    notifications: sent,
    totals: {
      orderCount: orders.length,
      spentPaise,
      lastOrderAt: orders[0]?.placedAt ?? null,
      firstOrderAt: orders.at(-1)?.placedAt ?? null,
      averagePaise: live.length > 0 ? Math.round(spentPaise / live.length) : 0,
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

/** Refuses while orders point at the customer, so history never loses its buyer. */
export async function deleteCustomer(tx: StoreTx, id: string) {
  const [linked] = await tx.select({ total: count() }).from(order).where(eq(order.customerId, id))
  const orders = linked?.total ?? 0
  if (orders > 0) return { deleted: false as const, orders }
  await tx.delete(customer).where(eq(customer.id, id))
  return { deleted: true as const, orders: 0 }
}

/** Adds or removes one tag across a selection, leaving the rest of each list alone. */
export async function tagCustomers(
  tx: StoreTx,
  input: { ids: string[]; tag: string; action: 'add' | 'remove' },
) {
  const tag = input.tag.trim().toLowerCase()
  if (input.ids.length === 0 || !tag) return { updated: 0 }
  const rows = await tx
    .select({ id: customer.id, tags: customer.tags })
    .from(customer)
    .where(inArray(customer.id, input.ids))
  let updated = 0
  for (const row of rows) {
    const has = row.tags.includes(tag)
    if (input.action === 'add' ? has : !has) continue
    const next = input.action === 'add' ? [...row.tags, tag] : row.tags.filter((t) => t !== tag)
    await tx
      .update(customer)
      .set({ tags: next, updatedAt: new Date() })
      .where(eq(customer.id, row.id))
    updated += 1
  }
  return { updated }
}

/** Every tag in use, for the filter popover and the bulk menu. */
export async function customerTags(tx: StoreTx): Promise<string[]> {
  const rows = await tx
    .select({ tag: sql<string>`distinct unnest(${customer.tags})` })
    .from(customer)
  return rows.map((r) => r.tag).sort()
}

export async function listSegments(tx: StoreTx, now = new Date()) {
  const [segments, everyone] = await Promise.all([
    tx.select().from(customerSegment).orderBy(asc(customerSegment.name)),
    listAllCustomers(tx, {}, now),
  ])
  return segments.map((s) => ({
    ...s,
    customerCount: everyone.filter((cu) => evaluateSegment(toSegmentCustomer(cu), s.rules, now))
      .length,
  }))
}

export async function getSegment(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(customerSegment).where(eq(customerSegment.id, id))
  return row ?? null
}

export async function saveSegment(
  tx: StoreTx,
  input: { id?: string | undefined; name: string; rules: CustomerSegmentRules; storeId: string },
) {
  if (input.id) {
    const [row] = await tx
      .update(customerSegment)
      .set({ name: input.name, rules: input.rules, updatedAt: new Date() })
      .where(eq(customerSegment.id, input.id))
      .returning()
    return row ?? null
  }
  const [row] = await tx
    .insert(customerSegment)
    .values({ storeId: input.storeId, name: input.name, rules: input.rules })
    .returning()
  return row ?? null
}

export async function deleteSegment(tx: StoreTx, id: string) {
  await tx.delete(customerSegment).where(eq(customerSegment.id, id))
}

/** Customers matching a rule set; drives the builder preview and the segment page. */
export async function listSegmentCustomers(
  tx: StoreTx,
  rules: CustomerSegmentRules,
  now = new Date(),
) {
  const everyone = await listAllCustomers(tx, {}, now)
  return everyone.filter((cu) => evaluateSegment(toSegmentCustomer(cu), rules, now))
}

/** Customers whose last order predates the window; the win-back building block. */
export async function lapsedSince(tx: StoreTx, days: number, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * DAY_MS)
  return tx
    .select(SELECTION)
    .from(c)
    .where(and(sql`${lastOrderSql} is not null`, lte(sql`${lastOrderSql}`, cutoff)))
}

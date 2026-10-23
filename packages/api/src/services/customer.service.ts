import {
  decryptCustomerPhone,
  deleteMetafieldsOf,
  encryptCustomerPhone,
  evaluateSegment,
  normalisePhoneDigits,
  noteCustomerTagsChanged,
  notTestOrder,
  phoneBlindIndex,
  type SegmentCustomer,
} from '@commerce/core'
import type { CustomerSegmentRules, StoreTx } from '@commerce/db'
import { customer, customerSegment, notification, order } from '@commerce/db'
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { VisitorSource } from '../context'
import { conversionRate, istIsoDate, startOfIstDay } from './analytics-buckets'
import {
  buildCustomerOverviewSeries,
  type CustomerOverviewSeries,
  type OverviewOrder,
} from './customer-overview'

const DAY_MS = 86_400_000
const RECENT_WINDOW_DAYS = 30
/** The overview card plots one week against the week before (frame 5:3062). */
const WINDOW_DAYS = 7
/**
 * Drafts are not orders yet, and test-mode orders (gateway test keys) moved no real money:
 * neither counts as customer activity.
 */
const notDraft = and(ne(order.status, 'draft'), notTestOrder)

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
  /** Business (B2B) customers: true keeps those with a saved GSTIN, false those without. */
  business?: boolean | undefined
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
  /** Saved a GSTIN; the GSTIN itself stays on the customer page. */
  hasGstin: boolean
  orderCount: number
  spentPaise: number
  lastOrderAt: Date | null
  createdAt: Date
}

export type CustomerStats = {
  total: number
  /** How many existed a week ago, so the tile can show a change (frame 5:3026). */
  totalPrevious: number
  newThisMonth: number
  newLast7: number
  newPrevious7: number
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

/**
 * Per-customer totals; drafts and test-mode orders never count, and cancelled orders never
 * count towards spend.
 */
const orderCountSql = sql<number>`(
  select count(*)::int from ${order} o
  where o.customer_id = c.id and o.status <> 'draft' and not o.is_test)`
const spentSql = sql<number>`(
  select coalesce(sum(o.total_paise), 0)::int from ${order} o
  where o.customer_id = c.id and o.status not in ('cancelled', 'draft') and not o.is_test)`
const lastOrderSql = sql<Date | null>`(
  select max(o.placed_at) from ${order} o
  where o.customer_id = c.id and o.status <> 'draft' and not o.is_test)`
const citySql = sql<string | null>`(${c.defaultAddress} ->> 'city')`
const stateSql = sql<string | null>`(${c.defaultAddress} ->> 'stateCode')`
const hasGstinSql = sql<boolean>`(coalesce(btrim(${c.gstin}), '') <> '')`

const SELECTION = {
  id: c.id,
  name: c.name,
  email: c.email,
  phone: c.phone,
  city: citySql,
  stateCode: stateSql,
  tags: c.tags,
  acceptsMarketing: c.acceptsMarketing,
  hasGstin: hasGstinSql,
  orderCount: orderCountSql,
  spentPaise: spentSql,
  lastOrderAt: lastOrderSql,
  createdAt: c.createdAt,
}

/**
 * `customer.phone` is encrypted, so it can no longer be `ilike`d; a search that looks
 * like a phone number (4+ digits once punctuation is stripped) instead matches the
 * HMAC blind index exactly — a real trade-off of encrypting the column (see
 * `docs/security/data-protection.md`), not a bug: "987" no longer finds "9876543210".
 */
function filterWhere(input: CustomerQuery, now: Date, secret: string) {
  const monthAgo = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS)
  const searchDigits = input.search ? normalisePhoneDigits(input.search) : ''
  const phoneMatch =
    searchDigits.length >= 4 ? eq(c.phoneIndex, phoneBlindIndex(searchDigits, secret)) : undefined
  return and(
    input.search
      ? or(ilike(c.name, `%${input.search}%`), ilike(c.email, `%${input.search}%`), phoneMatch)
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
    input.business === undefined
      ? undefined
      : input.business
        ? hasGstinSql
        : sql`not ${hasGstinSql}`,
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
    hasGstin: item.hasGstin,
  }
}

/** Decrypts the SELECTION-shaped `phone` in place; passes plaintext (not-yet-backfilled) rows through. */
function decryptListItem(item: CustomerListItem, secret: string): CustomerListItem {
  return { ...item, phone: decryptCustomerPhone(item.phone, secret) }
}

export async function listCustomers(
  tx: StoreTx,
  input: { page: number; perPage: number; sort?: CustomerSort | undefined } & CustomerQuery,
  secret: string,
  now = new Date(),
) {
  const where = filterWhere(input, now, secret)
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
  return { items: items.map((item) => decryptListItem(item, secret)), total: countRow?.total ?? 0 }
}

export async function customerStats(tx: StoreTx, now = new Date()): Promise<CustomerStats> {
  const monthAgo = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS)
  const weekStart = startOfIstDay(now, WINDOW_DAYS - 1)
  const previousStart = startOfIstDay(now, WINDOW_DAYS * 2 - 1)
  const [row] = await tx
    .select({
      total: count(),
      totalPrevious: sql<number>`count(*) filter (where ${c.createdAt} < ${weekStart.toISOString()}::timestamptz)::int`,
      newThisMonth: sql<number>`count(*) filter (where ${c.createdAt} >= ${monthAgo.toISOString()}::timestamptz)::int`,
      newLast7: sql<number>`count(*) filter (where ${c.createdAt} >= ${weekStart.toISOString()}::timestamptz)::int`,
      newPrevious7: sql<number>`count(*) filter (where ${c.createdAt} >= ${previousStart.toISOString()}::timestamptz and ${c.createdAt} < ${weekStart.toISOString()}::timestamptz)::int`,
      returning: sql<number>`count(*) filter (where ${orderCountSql} > 1)::int`,
      marketing: sql<number>`count(*) filter (where ${c.acceptsMarketing})::int`,
      averageLifetimePaise: sql<number>`coalesce(round(avg(${spentSql})), 0)::int`,
    })
    .from(c)
  return {
    total: row?.total ?? 0,
    totalPrevious: row?.totalPrevious ?? 0,
    newThisMonth: row?.newThisMonth ?? 0,
    newLast7: row?.newLast7 ?? 0,
    newPrevious7: row?.newPrevious7 ?? 0,
    returning: row?.returning ?? 0,
    marketing: row?.marketing ?? 0,
    averageLifetimePaise: row?.averageLifetimePaise ?? 0,
  }
}

export type CustomerOverview = {
  /** Headline figures above the chart, covering the last seven days. */
  activeCustomers: number
  repeatCustomers: number
  shopVisitors: number
  /** Orders per visitor over the window, as a percentage; null when there were no visitors. */
  conversionRate: number | null
  /** Visitor window for the third tile, with the week before for its delta. */
  visitors: { value: number; previous: number }
  thisWeek: CustomerOverviewSeries
  lastWeek: CustomerOverviewSeries
}

const sum = (values: number[]) => values.reduce((total, n) => total + n, 0)

/**
 * The "Customer Overview" card (frame 5:3062): who bought, who came back, who
 * browsed, and how the two relate, for this week and the week before. Visitors
 * come from the same daily HyperLogLogs the analytics section reads; without a
 * visitor source the browsing series reads zero rather than guessing.
 */
export async function customerOverview(
  tx: StoreTx,
  opts: { storeId?: string | undefined; visitors?: VisitorSource | undefined; now?: Date } = {},
): Promise<CustomerOverview> {
  const now = opts.now ?? new Date()
  const thisStart = startOfIstDay(now, WINDOW_DAYS - 1)
  const lastStart = startOfIstDay(now, WINDOW_DAYS * 2 - 1)
  const allDays = Array.from({ length: WINDOW_DAYS * 2 }, (_, i) =>
    istIsoDate(new Date(lastStart.getTime() + i * DAY_MS)),
  )

  const rows = await tx
    .select({ at: order.placedAt, customerId: order.customerId })
    .from(order)
    .where(and(notDraft, gte(order.placedAt, lastStart)))

  const ids = [...new Set(rows.map((r) => r.customerId).filter((id): id is string => id !== null))]
  const lifetime =
    ids.length > 0
      ? await tx
          .select({ id: order.customerId, orders: count() })
          .from(order)
          .where(and(notDraft, inArray(order.customerId, ids)))
          .groupBy(order.customerId)
      : []
  const repeatIds = new Set(lifetime.filter((r) => r.orders > 1).map((r) => r.id))

  const orders: OverviewOrder[] = rows.map((r) => ({
    at: r.at,
    customerId: r.customerId,
    repeat: r.customerId !== null && repeatIds.has(r.customerId),
  }))
  const daily = (await opts.visitors?.daily?.(opts.storeId ?? '', allDays)) ?? {
    perDay: allDays.map(() => 0),
    total: 0,
  }

  const lastWeek = buildCustomerOverviewSeries({
    days: allDays.slice(0, WINDOW_DAYS),
    orders,
    visitors: daily.perDay.slice(0, WINDOW_DAYS),
  })
  const thisWeek = buildCustomerOverviewSeries({
    days: allDays.slice(WINDOW_DAYS),
    orders,
    visitors: daily.perDay.slice(WINDOW_DAYS),
  })

  const recent = orders.filter((o) => o.at >= thisStart)
  const active = new Set(recent.map((o, i) => o.customerId ?? `guest:${i}`))
  const repeat = new Set(
    recent.filter((o) => o.repeat).map((o, i) => o.customerId ?? `repeat-guest:${i}`),
  )
  const visitorsThis = sum(thisWeek.shopVisitors)
  return {
    activeCustomers: active.size,
    repeatCustomers: repeat.size,
    shopVisitors: visitorsThis,
    conversionRate:
      visitorsThis > 0 ? Math.round(conversionRate(recent.length, visitorsThis) * 1000) / 10 : null,
    visitors: { value: visitorsThis, previous: sum(lastWeek.shopVisitors) },
    thisWeek,
    lastWeek,
  }
}

/** Every customer matching the current filter, for CSV export and segment previews. */
export async function listAllCustomers(
  tx: StoreTx,
  input: CustomerQuery,
  secret: string,
  now = new Date(),
): Promise<CustomerListItem[]> {
  const items = await tx
    .select(SELECTION)
    .from(c)
    .where(filterWhere(input, now, secret))
    .orderBy(desc(c.createdAt))
  return items.map((item) => decryptListItem(item, secret))
}

export async function getCustomer(tx: StoreTx, id: string, secret: string) {
  const [raw] = await tx.select().from(customer).where(eq(customer.id, id))
  if (!raw) return null
  const row = { ...raw, phone: decryptCustomerPhone(raw.phone, secret) }
  const [orders, sent] = await Promise.all([
    tx
      .select({
        id: order.id,
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        paymentMethod: order.paymentMethod,
        totalPaise: order.totalPaise,
        placedAt: order.placedAt,
        isTest: order.isTest,
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
  // The list still shows test-mode orders; the totals leave them out.
  const real = orders.filter((o) => !o.isTest)
  const live = real.filter((o) => o.status !== 'cancelled')
  const spentPaise = live.reduce((sum, o) => sum + o.totalPaise, 0)
  const { phoneIndex: _phoneIndex, ...customerFields } = row
  return {
    ...customerFields,
    orders,
    notifications: sent,
    totals: {
      orderCount: real.length,
      spentPaise,
      lastOrderAt: real[0]?.placedAt ?? null,
      firstOrderAt: real.at(-1)?.placedAt ?? null,

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
    gstin?: string | null | undefined
    businessName?: string | null | undefined
  },
  secret: string,
) {
  const { phone, ...rest } = patch
  const [before] = patch.tags
    ? await tx.select({ tags: customer.tags }).from(customer).where(eq(customer.id, id))
    : []
  const phoneUpdate =
    phone === undefined
      ? {}
      : phone === null || phone === ''
        ? { phone: null, phoneIndex: null, phoneVerifiedAt: null }
        : {
            phone: encryptCustomerPhone(phone, secret).cipher,
            phoneIndex: phoneBlindIndex(phone, secret),
            // Staff typing a number does not prove it is the shopper's; an unchanged number
            // keeps its proof (phone sign-in trusts only proven numbers).
            phoneVerifiedAt: sql`case when ${customer.phoneIndex} = ${phoneBlindIndex(phone, secret)} then ${customer.phoneVerifiedAt} else null end`,
          }
  const [row] = await tx
    .update(customer)
    .set({ ...rest, ...phoneUpdate, updatedAt: new Date() })
    .where(eq(customer.id, id))
    .returning()
  if (!row) return null
  if (before && patch.tags) await noteCustomerTagsChanged(tx, undefined, id, before.tags, row.tags)
  const { phoneIndex: _phoneIndex, ...rest2 } = row
  return { ...rest2, phone: decryptCustomerPhone(row.phone, secret) }
}

/** Refuses while orders point at the customer, so history never loses its buyer. */
export async function deleteCustomer(tx: StoreTx, id: string) {
  const [linked] = await tx.select({ total: count() }).from(order).where(eq(order.customerId, id))
  const orders = linked?.total ?? 0
  if (orders > 0) return { deleted: false as const, orders }
  await deleteMetafieldsOf(tx, 'customer', [id])
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
    await noteCustomerTagsChanged(tx, undefined, row.id, row.tags, next)
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

export async function listSegments(tx: StoreTx, secret: string, now = new Date()) {
  const [segments, everyone] = await Promise.all([
    tx.select().from(customerSegment).orderBy(asc(customerSegment.name)),
    listAllCustomers(tx, {}, secret, now),
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
  secret: string,
  now = new Date(),
) {
  const everyone = await listAllCustomers(tx, {}, secret, now)
  return everyone.filter((cu) => evaluateSegment(toSegmentCustomer(cu), rules, now))
}

/** Customers whose last order predates the window; the win-back building block. */
export async function lapsedSince(tx: StoreTx, days: number, secret: string, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * DAY_MS)
  const items = await tx
    .select(SELECTION)
    .from(c)
    .where(and(sql`${lastOrderSql} is not null`, lte(sql`${lastOrderSql}`, cutoff)))
  return items.map((item) => decryptListItem(item, secret))
}

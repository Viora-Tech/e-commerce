import { importedMethod, notTestOrder } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  address,
  cart,
  customer,
  media,
  order,
  orderLine,
  product,
  productMedia,
  variant,
} from '@commerce/db'
import { and, asc, count, desc, eq, gte, inArray, lt, ne, sql, sum } from 'drizzle-orm'
import type { LiveVisitors, VisitorSource } from '../context'
import {
  averageOrderValue,
  buildFunnel,
  conversionRate,
  delta,
  type FunnelStep,
  type RangeInput,
  type ResolvedRange,
  resolveRange,
  returningRate,
  type SeriesPoint,
  startOfIstDay,
  toDailyPoints,
  toWeeklyPoints,
} from './analytics-buckets'
import { breakdownLines, type SalesBreakdownLine, salesBreakdownSums } from './sales-breakdown'
import { countSessions, importedTrafficDays, totalSessions } from './sessions'
import { countWhere, istDaySql, sumInt } from './sql-buckets'

/** Drafts are not orders: they never reach revenue, counts or the funnel. */
/** Test-mode orders (gateway test keys, no real money) are left out too. */
const notDraft = and(ne(order.status, 'draft'), notTestOrder)
const counted = and(notDraft, ne(order.status, 'cancelled'))

const TOP_PRODUCTS = 8
const STATE_ROWS = 8
const LIVE_EVENTS = 12
const HOUR_MS = 3_600_000

export type AnalyticsKpi = {
  id: 'sessions' | 'orders' | 'revenue' | 'conversion' | 'aov' | 'returning'
  value: number
  previous: number
  /** Fractional change, null when the previous period was empty. */
  delta: number | null
  /** One point per day of the range, for the tile sparkline. */
  series: number[]
}

export type AnalyticsOverview = {
  range: { key: string; from: string; to: string; days: string[] }
  kpis: AnalyticsKpi[]
  salesOverTime: { day: SeriesPoint[]; week: SeriesPoint[] }
  topProducts: {
    productId: string
    title: string
    units: number
    revenuePaise: number
    imageUrl: string | null
  }[]
  salesByState: { stateCode: string; orders: number; revenuePaise: number; share: number }[]
  paymentMethods: { method: string; orders: number; revenuePaise: number; share: number }[]
  channels: { channel: string; orders: number; revenuePaise: number; share: number }[]
  funnel: FunnelStep[]
  /** Gross → discounts → returns → net → shipping → total, now and for the period before. */
  salesBreakdown: { current: SalesBreakdownLine[]; previous: SalesBreakdownLine[] }
}

export type AnalyticsLive = {
  visitors: LiveVisitors
  /** Carts touched in the last hour that have not converted. */
  activeCarts: number
  ordersLastHour: number
  revenueLastHourPaise: number
  events: {
    id: string
    kind: 'order' | 'cart'
    at: Date
    label: string
    valuePaise: number | null
  }[]
}

/** One group of a range's counted orders: same IST day, payment method, tracking and returning. */
type OrderGroup = {
  day: string
  paymentMethod: string | null
  /** The old platform's gateway names on an imported order (`UPI Id`, `Cards, UPI… by Razorpay`). */
  importedGateway: string | null
  /** Placed through a tracked storefront session; only these convert sessions (audit #95). */
  tracked: boolean
  /** The customer had already ordered before this order. */
  returning: boolean
  orders: number
  revenuePaise: number
}

/**
 * The range's counted orders grouped in Postgres, so a year of orders comes back as a few
 * hundred rows. "Returning" compares each order with its customer's first counted order at
 * millisecond precision, as the JS Date comparison it replaces did.
 */
async function orderGroups(tx: StoreTx, from: Date, to: Date): Promise<OrderGroup[]> {
  const inRange = and(counted, gte(order.placedAt, from), lt(order.placedAt, to))
  const firsts = tx.$with('firsts').as(
    tx
      .select({
        customerId: order.customerId,
        firstAt: sql<Date>`date_trunc('milliseconds', min(${order.placedAt}))`.as('first_at'),
      })
      .from(order)
      .where(
        and(
          counted,
          inArray(order.customerId, tx.select({ id: order.customerId }).from(order).where(inRange)),
        ),
      )
      .groupBy(order.customerId),
  )
  const day = istDaySql(order.placedAt)
  const importedGateway = sql<string | null>`${order.importMeta}->>'paymentMethod'`
  const tracked = sql<boolean>`(${order.attribution}->>'channel') is not null`
  const returning = sql<boolean>`coalesce(date_trunc('milliseconds', ${order.placedAt}) > ${firsts.firstAt}, false)`
  return tx
    .with(firsts)
    .select({
      day,
      paymentMethod: order.paymentMethod,
      importedGateway,
      tracked,
      returning,
      orders: countWhere(undefined),
      revenuePaise: sumInt(order.totalPaise),
    })
    .from(order)
    .leftJoin(firsts, eq(firsts.customerId, order.customerId))
    .where(inRange)
    .groupBy(day, order.paymentMethod, importedGateway, tracked, returning)
}

/** Sum `pick` over the groups that pass `keep`, one value per day of `days`. */
function byDay(
  groups: OrderGroup[],
  days: string[],
  pick: (g: OrderGroup) => number,
  keep: (g: OrderGroup) => boolean = () => true,
): number[] {
  const index = new Map(days.map((d, i) => [d, i]))
  const out = days.map(() => 0)
  for (const g of groups) {
    const i = index.get(g.day)
    if (i === undefined || !keep(g)) continue
    out[i] = (out[i] ?? 0) + pick(g)
  }
  return out
}

const total = (groups: OrderGroup[], pick: (g: OrderGroup) => number) =>
  groups.reduce((n, g) => n + pick(g), 0)

function share(value: number, total: number): number {
  return total > 0 ? value / total : 0
}

async function productImages(tx: StoreTx, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(inArray(productMedia.productId, ids))
    .orderBy(asc(productMedia.position))
  const out = new Map<string, string>()
  for (const r of rows) if (!out.has(r.productId)) out.set(r.productId, r.url)
  return out
}

/**
 * Everything the analytics overview shows for one range, plus the same metrics
 * for the period immediately before it so every tile can state a change.
 */
export async function analyticsOverview(
  tx: StoreTx,
  opts: {
    range?: RangeInput
    storeId?: string
    visitors?: VisitorSource | undefined
    now?: Date
  } = {},
): Promise<AnalyticsOverview> {
  const now = opts.now ?? new Date()
  const range: ResolvedRange = resolveRange(opts.range ?? { key: '30d' }, now)
  const [current, previous] = await Promise.all([
    orderGroups(tx, range.from, range.to),
    orderGroups(tx, range.previousFrom, range.previousTo),
  ])
  const [sessionsPerDay, sessionsPrev] = await Promise.all([
    countSessions(tx, range, false),
    totalSessions(tx, range.previousFrom, range.previousTo),
  ])

  const orders = (g: OrderGroup) => g.orders
  const paise = (g: OrderGroup) => g.revenuePaise
  const ordersNow = total(current, orders)
  const ordersPrev = total(previous, orders)
  const revenue = total(current, paise)
  const revenuePrev = total(previous, paise)
  const returningNow = total(current, (g) => (g.returning ? g.orders : 0))
  const returningPrev = total(previous, (g) => (g.returning ? g.orders : 0))
  const sessionTotal = sessionsPerDay.reduce((n, v) => n + v, 0)

  const revenueByDay = byDay(current, range.days, paise)
  const ordersByDay = byDay(current, range.days, orders)
  // Only orders with sessions behind them convert: one placed through this storefront, or an
  // imported one on a day with imported traffic. Other imported history (101 orders vs 19
  // sessions) read as "100% conversion" (audit #95).
  const [importedNow, importedPrev] = await Promise.all([
    importedTrafficDays(tx, range.from, range.to),
    importedTrafficDays(tx, range.previousFrom, range.previousTo),
  ])
  const convertsIn = (days: Set<string>) => (g: OrderGroup) => g.tracked || days.has(g.day)
  const trackedNow = total(current.filter(convertsIn(importedNow)), orders)
  const trackedPrev = total(previous.filter(convertsIn(importedPrev)), orders)
  const trackedByDay = byDay(current, range.days, orders, convertsIn(importedNow))
  const returningByDay = byDay(current, range.days, orders, (g) => g.returning)

  const kpis: AnalyticsKpi[] = [
    {
      id: 'sessions',
      value: sessionTotal,
      previous: sessionsPrev,
      delta: delta(sessionTotal, sessionsPrev),
      series: sessionsPerDay,
    },
    {
      id: 'revenue',
      value: revenue,
      previous: revenuePrev,
      delta: delta(revenue, revenuePrev),
      series: revenueByDay,
    },
    {
      id: 'orders',
      value: ordersNow,
      previous: ordersPrev,
      delta: delta(ordersNow, ordersPrev),
      series: ordersByDay,
    },
    {
      id: 'conversion',
      value: conversionRate(trackedNow, sessionTotal),
      previous: conversionRate(trackedPrev, sessionsPrev),
      delta: delta(
        conversionRate(trackedNow, sessionTotal),
        conversionRate(trackedPrev, sessionsPrev),
      ),
      series: trackedByDay.map((o, i) => conversionRate(o, sessionsPerDay[i] ?? 0)),
    },
    {
      id: 'aov',
      value: averageOrderValue(revenue, ordersNow),
      previous: averageOrderValue(revenuePrev, ordersPrev),
      delta: delta(
        averageOrderValue(revenue, ordersNow),
        averageOrderValue(revenuePrev, ordersPrev),
      ),
      series: revenueByDay.map((r, i) => averageOrderValue(r, ordersByDay[i] ?? 0)),
    },
    {
      id: 'returning',
      value: returningRate(returningNow, ordersNow),
      previous: returningRate(returningPrev, ordersPrev),
      delta: delta(
        returningRate(returningNow, ordersNow),
        returningRate(returningPrev, ordersPrev),
      ),
      series: returningByDay.map((r, i) => returningRate(r, ordersByDay[i] ?? 0)),
    },
  ]

  const inRange = and(counted, gte(order.placedAt, range.from), lt(order.placedAt, range.to))
  const lineRevenue = sum(sql`${orderLine.quantity} * ${orderLine.unitPricePaise}`)
  const [topRows, stateRows, [cartsRow], [checkoutRow], breakdownNow, breakdownPrev] =
    await Promise.all([
      tx
        .select({
          productId: variant.productId,
          title: product.title,
          units: sum(orderLine.quantity).mapWith(Number),
          revenuePaise: lineRevenue.mapWith(Number),
        })
        .from(orderLine)
        .innerJoin(order, eq(order.id, orderLine.orderId))
        .innerJoin(variant, eq(variant.id, orderLine.variantId))
        .innerJoin(product, eq(product.id, variant.productId))
        .where(inRange)
        .groupBy(variant.productId, product.title)
        .orderBy(desc(lineRevenue))
        .limit(TOP_PRODUCTS),
      tx
        .select({
          stateCode: address.stateCode,
          orders: count(),
          revenuePaise: sum(order.totalPaise).mapWith(Number),
        })
        .from(order)
        .innerJoin(address, eq(address.id, order.shippingAddressId))
        .where(inRange)
        .groupBy(address.stateCode)
        .orderBy(desc(sum(order.totalPaise)))
        .limit(STATE_ROWS),
      tx
        .select({ n: count() })
        .from(cart)
        .where(and(gte(cart.createdAt, range.from), lt(cart.createdAt, range.to))),
      tx
        .select({ n: count() })
        .from(cart)
        .where(
          and(
            gte(cart.createdAt, range.from),
            lt(cart.createdAt, range.to),
            sql`${cart.email} is not null`,
          ),
        ),
      salesBreakdownSums(tx, range.from, range.to),
      salesBreakdownSums(tx, range.previousFrom, range.previousTo),
    ])
  const images = await productImages(
    tx,
    topRows.map((r) => r.productId),
  )

  const byMethod = new Map<string, { orders: number; revenuePaise: number }>()
  for (const g of current) {
    const key = g.paymentMethod ?? importedMethod(g.importedGateway) ?? 'unknown'
    const entry = byMethod.get(key) ?? { orders: 0, revenuePaise: 0 }
    entry.orders += g.orders
    entry.revenuePaise += g.revenuePaise
    byMethod.set(key, entry)
  }

  return {
    range: {
      key: range.key,
      from: range.days[0] ?? '',
      to: range.days.at(-1) ?? '',
      days: range.days,
    },
    kpis,
    salesOverTime: {
      day: toDailyPoints(range.days, revenueByDay),
      week: toWeeklyPoints(range.days, revenueByDay),
    },
    topProducts: topRows.map((r) => ({ ...r, imageUrl: images.get(r.productId) ?? null })),
    salesByState: stateRows.map((r) => ({ ...r, share: share(r.revenuePaise, revenue) })),
    paymentMethods: [...byMethod.entries()]
      .map(([method, v]) => ({ method, ...v, share: share(v.revenuePaise, revenue) }))
      .sort((a, b) => b.revenuePaise - a.revenuePaise || a.method.localeCompare(b.method)),
    /* One sales channel today; the shape is ready for marketplaces and POS. */
    channels: [
      {
        channel: 'online',
        orders: ordersNow,
        revenuePaise: revenue,
        share: revenue > 0 ? 1 : 0,
      },
    ],
    funnel: buildFunnel({
      sessions: sessionTotal,
      carts: cartsRow?.n ?? 0,
      checkouts: checkoutRow?.n ?? 0,
      orders: trackedNow,
    }),
    salesBreakdown: {
      current: breakdownLines(breakdownNow),
      previous: breakdownLines(breakdownPrev),
    },
  }
}

/** The live view: visitors now, carts in flight and what has happened in the last hour. */
export async function analyticsLive(
  tx: StoreTx,
  opts: { storeId?: string; visitors?: VisitorSource | undefined; now?: Date } = {},
): Promise<AnalyticsLive> {
  const now = opts.now ?? new Date()
  const hourAgo = new Date(now.getTime() - HOUR_MS)
  const visitors =
    opts.visitors && opts.storeId
      ? await opts.visitors.live(opts.storeId)
      : { last30: 0, perMinute: Array.from({ length: 30 }, () => 0) }

  const [cartsRow] = await tx
    .select({ n: count() })
    .from(cart)
    .where(and(eq(cart.status, 'open'), gte(cart.updatedAt, hourAgo)))

  const recentOrders = await tx
    .select({
      id: order.id,
      number: order.number,
      totalPaise: order.totalPaise,
      placedAt: order.placedAt,
      customerName: customer.name,
      email: order.email,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(and(counted, gte(order.placedAt, startOfIstDay(now))))
    .orderBy(desc(order.placedAt))
    .limit(LIVE_EVENTS)

  const recentCarts = await tx
    .select({ id: cart.id, at: cart.createdAt, email: cart.email })
    .from(cart)
    .where(gte(cart.createdAt, startOfIstDay(now)))
    .orderBy(desc(cart.createdAt))
    .limit(LIVE_EVENTS)

  // Counted on its own: the event list starts at IST midnight and is capped, so between 00:00
  // and 01:00 (or on a busy day) it would miss orders from the last hour.
  const [lastHour] = await tx
    .select({ n: count(), revenue: sum(order.totalPaise) })
    .from(order)
    .where(and(counted, gte(order.placedAt, hourAgo)))
  const events: AnalyticsLive['events'] = [
    ...recentOrders.map((o) => ({
      id: `order-${o.id}`,
      kind: 'order' as const,
      at: o.placedAt,
      label: `#${o.number} ${o.customerName ?? o.email ?? ''}`.trim(),
      valuePaise: o.totalPaise,
    })),
    ...recentCarts.map((c) => ({
      id: `cart-${c.id}`,
      kind: 'cart' as const,
      at: c.at,
      label: c.email ?? '',
      valuePaise: null,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, LIVE_EVENTS)

  return {
    visitors,
    activeCarts: cartsRow?.n ?? 0,
    ordersLastHour: Number(lastHour?.n ?? 0),
    revenueLastHourPaise: Number(lastHour?.revenue ?? 0),
    events,
  }
}

export type SaleDay = { day: string; revenuePaise: number; orders: number }

/**
 * The store's own biggest sales days in the last year, for the date picker's "Big sale days":
 * real dates from its orders (IST days), not a fixed festival calendar.
 */
export async function bigSaleDays(tx: StoreTx, limit = 5): Promise<SaleDay[]> {
  const day = sql<string>`to_char(${order.placedAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`
  const rows = await tx
    .select({
      day,
      revenue: sql<number>`coalesce(sum(${order.totalPaise}), 0)::bigint`,
      orders: sql<number>`count(*)::int`,
    })
    .from(order)
    .where(
      and(
        sql`${order.status} not in ('draft', 'cancelled')`,
        notTestOrder,
        gte(order.placedAt, sql`now() - interval '365 days'`),
      ),
    )
    .groupBy(day)
    .orderBy(desc(sql`2`))
    .limit(limit)
  return rows.map((r) => ({ day: r.day, revenuePaise: Number(r.revenue), orders: r.orders }))
}

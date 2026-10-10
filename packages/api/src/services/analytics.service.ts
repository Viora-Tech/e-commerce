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
import type { DailyVisitors, LiveVisitors, VisitorSource } from '../context'
import {
  averageOrderValue,
  bucketByDay,
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

/** Drafts are not orders: they never reach revenue, counts or the funnel. */
const notDraft = ne(order.status, 'draft')
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

type OrderRow = {
  id: string
  placedAt: Date
  totalPaise: number
  customerId: string | null
  email: string | null
  paymentMethod: string | null
}

async function ordersIn(tx: StoreTx, from: Date, to: Date): Promise<OrderRow[]> {
  return tx
    .select({
      id: order.id,
      placedAt: order.placedAt,
      totalPaise: order.totalPaise,
      customerId: order.customerId,
      email: order.email,
      paymentMethod: order.paymentMethod,
    })
    .from(order)
    .where(and(counted, gte(order.placedAt, from), lt(order.placedAt, to)))
}

async function sessionsFor(
  visitors: VisitorSource | undefined,
  storeId: string | undefined,
  days: string[],
): Promise<DailyVisitors> {
  if (!visitors?.daily || !storeId) return { perDay: days.map(() => 0), total: 0 }
  return visitors.daily(storeId, days)
}

/** Orders whose customer had already ordered before the order in question. */
async function returningOrderIds(tx: StoreTx, rows: OrderRow[]): Promise<Set<string>> {
  const ids = [...new Set(rows.map((r) => r.customerId).filter((v): v is string => v !== null))]
  if (ids.length === 0) return new Set()
  const firstOrders = await tx
    .select({ customerId: order.customerId, firstAt: sql<Date>`min(${order.placedAt})` })
    .from(order)
    .where(and(counted, inArray(order.customerId, ids)))
    .groupBy(order.customerId)
  const firstByCustomer = new Map(firstOrders.map((r) => [r.customerId, new Date(r.firstAt)]))
  const out = new Set<string>()
  for (const r of rows) {
    if (!r.customerId) continue
    const first = firstByCustomer.get(r.customerId)
    if (first && r.placedAt.getTime() > first.getTime()) out.add(r.id)
  }
  return out
}

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
    ordersIn(tx, range.from, range.to),
    ordersIn(tx, range.previousFrom, range.previousTo),
  ])
  const sessions = await sessionsFor(opts.visitors, opts.storeId, range.days)

  const revenue = current.reduce((n, r) => n + r.totalPaise, 0)
  const revenuePrev = previous.reduce((n, r) => n + r.totalPaise, 0)
  const returning = await returningOrderIds(tx, current)
  const returningPrev = await returningOrderIds(tx, previous)
  const sessionTotal = sessions.total
  /* No historical session store, so the comparison period reads zero rather than a wrong number. */
  const sessionsPrev = 0

  const revenueByDay = bucketByDay(
    current.map((r) => ({ at: r.placedAt, weight: r.totalPaise })),
    range.days,
  )
  const ordersByDay = bucketByDay(
    current.map((r) => ({ at: r.placedAt })),
    range.days,
  )
  const returningByDay = bucketByDay(
    current.filter((r) => returning.has(r.id)).map((r) => ({ at: r.placedAt })),
    range.days,
  )

  const kpis: AnalyticsKpi[] = [
    {
      id: 'sessions',
      value: sessionTotal,
      previous: sessionsPrev,
      delta: delta(sessionTotal, sessionsPrev),
      series: sessions.perDay,
    },
    {
      id: 'orders',
      value: current.length,
      previous: previous.length,
      delta: delta(current.length, previous.length),
      series: ordersByDay,
    },
    {
      id: 'revenue',
      value: revenue,
      previous: revenuePrev,
      delta: delta(revenue, revenuePrev),
      series: revenueByDay,
    },
    {
      id: 'conversion',
      value: conversionRate(current.length, sessionTotal),
      previous: conversionRate(previous.length, sessionsPrev),
      delta: null,
      series: ordersByDay.map((o, i) => conversionRate(o, sessions.perDay[i] ?? 0)),
    },
    {
      id: 'aov',
      value: averageOrderValue(revenue, current.length),
      previous: averageOrderValue(revenuePrev, previous.length),
      delta: delta(
        averageOrderValue(revenue, current.length),
        averageOrderValue(revenuePrev, previous.length),
      ),
      series: revenueByDay.map((r, i) => averageOrderValue(r, ordersByDay[i] ?? 0)),
    },
    {
      id: 'returning',
      value: returningRate(returning.size, current.length),
      previous: returningRate(returningPrev.size, previous.length),
      delta: delta(
        returningRate(returning.size, current.length),
        returningRate(returningPrev.size, previous.length),
      ),
      series: returningByDay.map((r, i) => returningRate(r, ordersByDay[i] ?? 0)),
    },
  ]

  const topRows = await tx
    .select({
      productId: variant.productId,
      title: product.title,
      units: sum(orderLine.quantity).mapWith(Number),
      revenuePaise: sum(sql`${orderLine.quantity} * ${orderLine.unitPricePaise}`).mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(counted, gte(order.placedAt, range.from), lt(order.placedAt, range.to)))
    .groupBy(variant.productId, product.title)
    .orderBy(desc(sum(sql`${orderLine.quantity} * ${orderLine.unitPricePaise}`)))
    .limit(TOP_PRODUCTS)
  const images = await productImages(
    tx,
    topRows.map((r) => r.productId),
  )

  const stateRows = await tx
    .select({
      stateCode: address.stateCode,
      orders: count(),
      revenuePaise: sum(order.totalPaise).mapWith(Number),
    })
    .from(order)
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(and(counted, gte(order.placedAt, range.from), lt(order.placedAt, range.to)))
    .groupBy(address.stateCode)
    .orderBy(desc(sum(order.totalPaise)))
    .limit(STATE_ROWS)

  const byMethod = new Map<string, { orders: number; revenuePaise: number }>()
  for (const r of current) {
    const key = r.paymentMethod ?? 'unknown'
    const entry = byMethod.get(key) ?? { orders: 0, revenuePaise: 0 }
    entry.orders += 1
    entry.revenuePaise += r.totalPaise
    byMethod.set(key, entry)
  }

  const [cartsRow] = await tx
    .select({ n: count() })
    .from(cart)
    .where(and(gte(cart.createdAt, range.from), lt(cart.createdAt, range.to)))
  const [checkoutRow] = await tx
    .select({ n: count() })
    .from(cart)
    .where(
      and(
        gte(cart.createdAt, range.from),
        lt(cart.createdAt, range.to),
        sql`${cart.email} is not null`,
      ),
    )

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
      .sort((a, b) => b.revenuePaise - a.revenuePaise),
    /* One sales channel today; the shape is ready for marketplaces and POS. */
    channels: [
      {
        channel: 'online',
        orders: current.length,
        revenuePaise: revenue,
        share: revenue > 0 ? 1 : 0,
      },
    ],
    funnel: buildFunnel({
      sessions: sessionTotal,
      carts: cartsRow?.n ?? 0,
      checkouts: checkoutRow?.n ?? 0,
      orders: current.length,
    }),
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

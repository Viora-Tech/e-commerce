/** SOURCE OF TRUTH: team report figures — WHAT: reads a period's orders, sessions, sales breakdown, top sellers, sources and to-dos and returns the `PerformanceReport` for the daily summary and the weekly and monthly reports / WHY: the same rules as Analytics (cancelled, draft and test orders out; real-shopper sessions; net sales from the sales breakdown), so the email and the Analytics page never disagree */
import { dayStart } from '@commerce/dates'
import { media, order, orderLine, type StoreTx, store, variant } from '@commerce/db'
import type { PerformanceReport } from '@commerce/notifications'
import { and, desc, eq, gte, lt, ne, sql, sum } from 'drizzle-orm'
import {
  countWhere,
  importedTrafficDays,
  istDaySql,
  istHourSql,
  salesBreakdownSums,
  sumInt,
  totalSessions,
} from '../analytics-figures'
import { abandonedStats } from '../cart/abandoned'
import type { StoreContext } from '../context'
import { emailPicture, productCoverImages } from '../notifications/email-images'
import { NET_UNITS } from '../order/net-units'
import { notTestOrder } from '../order/test-orders'
import { composeReport, netSales, type PeriodTotals, type ReportFigures } from './report-compose'
import type { ReportPeriod, Span } from './report-periods'

const HOUR_MS = 3_600_000
const SELLERS = 3

/** Analytics' counted orders: no drafts, no cancelled orders, no test-mode or unpaid checkouts. */
const counted = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'), notTestOrder)
const inSpan = (s: Span) => and(counted, gte(order.placedAt, s.from), lt(order.placedAt, s.to))

type OrderGroup = {
  day: string
  hour: number
  tracked: boolean
  returning: boolean
  hasCustomer: boolean
  orders: number
  salesPaise: number
  revenuePaise: number
}

/**
 * The span's counted orders grouped in Postgres by IST day and hour, whether they carry a
 * marketing channel and whether the customer had a counted order before (the Analytics
 * overview's "returning" rule, compared at millisecond precision).
 */
async function orderGroups(tx: StoreTx, span: Span): Promise<OrderGroup[]> {
  const where = inSpan(span)
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
          sql`${order.customerId} in (select ${order.customerId} from ${order} where ${where})`,
        ),
      )
      .groupBy(order.customerId),
  )
  const day = istDaySql(order.placedAt)
  const hour = istHourSql(order.placedAt)
  const tracked = sql<boolean>`(${order.attribution}->>'channel') is not null`
  const returning = sql<boolean>`coalesce(date_trunc('milliseconds', ${order.placedAt}) > ${firsts.firstAt}, false)`
  const hasCustomer = sql<boolean>`${order.customerId} is not null`
  return tx
    .with(firsts)
    .select({
      day,
      hour,
      tracked,
      returning,
      hasCustomer,
      orders: countWhere(undefined),
      salesPaise: sumInt(sql`${order.subtotalPaise} - ${order.discountPaise}`),
      revenuePaise: sumInt(order.totalPaise),
    })
    .from(order)
    .leftJoin(firsts, eq(firsts.customerId, order.customerId))
    .where(where)
    .groupBy(day, hour, tracked, returning, hasCustomer)
}

async function periodTotals(tx: StoreTx, span: Span, groups: OrderGroup[]): Promise<PeriodTotals> {
  const [sessions, importedDays, breakdown] = await Promise.all([
    totalSessions(tx, span.from, span.to),
    importedTrafficDays(tx, span.from, span.to),
    salesBreakdownSums(tx, span.from, span.to),
  ])
  const add = (
    keep: (g: OrderGroup) => boolean,
    pick: (g: OrderGroup) => number = (g) => g.orders,
  ) => groups.reduce((n, g) => n + (keep(g) ? pick(g) : 0), 0)
  return {
    orders: add(() => true),
    // Only orders with sessions behind them convert, as on Analytics (audit #95).
    trackedOrders: add((g) => g.tracked || importedDays.has(g.day)),
    revenuePaise: add(
      () => true,
      (g) => g.revenuePaise,
    ),
    returningOrders: add((g) => g.returning),
    newCustomers: add((g) => !g.returning && g.hasCustomer),
    sessions,
    breakdown,
  }
}

/** Each group into the bar it falls in, by its IST day and hour. */
export function bucketGroups(
  period: ReportPeriod,
  groups: Pick<OrderGroup, 'day' | 'hour' | 'orders' | 'salesPaise'>[],
) {
  const out = period.buckets.map(() => ({ salesPaise: 0, orders: 0 }))
  for (const g of groups) {
    const at = dayStart(g.day).getTime() + g.hour * HOUR_MS
    const i = period.buckets.findIndex((b) => b.from.getTime() <= at && at < b.to.getTime())
    const b = out[i]
    if (!b) continue
    b.salesPaise += g.salesPaise
    b.orders += g.orders
  }
  return out
}

/** The span's best sellers by line revenue, one row per variant, with its picture. */
async function topSellers(tx: StoreTx, span: Span): Promise<ReportFigures['sellers']> {
  const revenue = sum(sql`${orderLine.quantity} * ${orderLine.unitPricePaise}`)
  const rows = await tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      productId: variant.productId,
      image: media.url,
      units: sum(NET_UNITS).mapWith(Number),
      revenuePaise: revenue.mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(media, and(eq(media.id, variant.mediaId), emailPicture))
    .where(inSpan(span))
    .groupBy(
      orderLine.variantId,
      orderLine.title,
      orderLine.variantTitle,
      variant.productId,
      media.url,
    )
    .orderBy(desc(revenue))
    .limit(SELLERS)
  const covers = await productCoverImages(
    tx,
    rows.map((r) => r.productId).filter((id): id is string => !!id),
  )
  return rows.map((r) => ({
    title: r.title ?? '',
    detail: r.variantTitle && r.variantTitle !== 'Default' ? r.variantTitle : '',
    units: r.units,
    revenuePaise: r.revenuePaise,
    imageUrl: r.image ?? (r.productId ? covers.get(r.productId) : undefined) ?? null,
  }))
}

/** Counted orders by the marketing channel they came through; untracked orders are left out. */
async function sources(tx: StoreTx, span: Span): Promise<ReportFigures['sources']> {
  const channel = sql<string>`${order.attribution}->>'channel'`
  const rows = await tx
    .select({ channel, orders: countWhere(undefined) })
    .from(order)
    .where(and(inSpan(span), sql`${channel} is not null`))
    .groupBy(channel)
  return rows
}

/**
 * The report for `period`: this period and the one before, the bars, the history and the
 * to-dos. `toShip` is the daily summary's packing count, worked out by its sender.
 */
export async function performanceReport(
  ctx: StoreContext,
  period: ReportPeriod,
  opts: { adminUrl: string; toShip?: number | undefined },
): Promise<PerformanceReport> {
  const { tx } = ctx
  const [nowGroups, previousGroups, sellers, bySource, [s]] = await Promise.all([
    orderGroups(tx, period),
    orderGroups(tx, period.previous),
    topSellers(tx, period),
    sources(tx, period),
    tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId)),
  ])
  const [now, previous, history] = await Promise.all([
    periodTotals(tx, period, nowGroups),
    periodTotals(tx, period.previous, previousGroups),
    Promise.all(period.history.map((h) => salesBreakdownSums(tx, h.from, h.to))),
  ])
  const abandoned =
    period.kind === 'daily'
      ? null
      : await abandonedStats(ctx, {
          days: Math.round((period.to.getTime() - period.from.getTime()) / (24 * HOUR_MS)),
          now: period.to,
        })
  const figures: ReportFigures = {
    storeName: s?.name ?? '',
    now,
    previous,
    buckets: bucketGroups(period, nowGroups),
    historyNetPaise: history.map(netSales),
    sellers,
    sources: bySource,
    toShip: opts.toShip ?? null,
    abandoned: abandoned
      ? { carts: abandoned.notRecovered, valuePaise: abandoned.valuePaise }
      : null,
  }
  return composeReport(period, figures, opts.adminUrl)
}

import { ABANDONED_AFTER_MS, notTestOrder } from '@commerce/core'
import { HOME_METRICS, type HomeMetric, parseHomeTiles } from '@commerce/core/home-metrics'
import { IST_OFFSET_MS } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import { cart, order, orderLine, product, refund, storeMember, variant } from '@commerce/db'
import { and, desc, eq, gte, inArray, isNotNull, lt, min, ne, or, sql, sum } from 'drizzle-orm'
import type { VisitorSource } from '../context'
import { DAY_MS, istDayStart, istIsoDate } from './analytics-buckets'
import { countSessions } from './sessions'

/** The longest span the Home analytics card reads at once (a financial year and a day). */
const HOME_ANALYTICS_MAX_DAYS = 366

/** What the dashed line compares against: the span just before, the same dates a year ago, or nothing. */
export type HomeCompare = 'previous' | 'year' | 'none'

export type HomeMetricFigures = {
  value: number
  /** The comparison span's figure; null when comparing is off. */
  previous: number | null
  /** One value per bucket (hour for a single day, else day). */
  series: number[]
  previousSeries: number[] | null
}

export type HomeAnalytics = {
  /** ISO days, or `0`..`23` hours when the range is a single day. */
  labels: string[]
  hourly: boolean
  metrics: Record<HomeMetric, HomeMetricFigures>
  /** The best seller by units in the range, for the Top products tile. */
  topProduct: { title: string; units: number } | null
}

type Window = { from: Date; to: Date; days: string[] }

const HOURS = 24
const counted = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'), notTestOrder)

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0)
}

function listDays(from: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => istIsoDate(new Date(from.getTime() + i * DAY_MS)))
}

/** The same span as `w`, either right before it or on the same dates a year earlier. */
function comparisonWindow(w: Window, compare: Exclude<HomeCompare, 'none'>): Window {
  if (compare === 'previous') {
    const span = w.to.getTime() - w.from.getTime()
    const from = new Date(w.from.getTime() - span)
    return { from, to: w.from, days: listDays(from, w.days.length) }
  }
  const back = (d: Date) => {
    const iso = istIsoDate(d)
    return istDayStart(`${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`)
  }
  const from = back(w.from)
  return {
    from,
    to: new Date(from.getTime() + (w.to.getTime() - w.from.getTime())),
    days: listDays(from, w.days.length),
  }
}

/** Raw rows for one window: orders, refunds and abandoned carts. */
async function load(tx: StoreTx, w: Window) {
  const inWindow = (col: typeof order.placedAt) => and(gte(col, w.from), lt(col, w.to))
  const [orders, refunds, carts] = await Promise.all([
    tx
      .select({
        id: order.id,
        at: order.placedAt,
        totalPaise: order.totalPaise,
        subtotalPaise: order.subtotalPaise,
        discountPaise: order.discountPaise,
        shippingPaise: order.shippingPaise,
        taxPaise: order.taxPaise,
        paymentMethod: order.paymentMethod,
        customerId: order.customerId,
      })
      .from(order)
      .where(and(counted, inWindow(order.placedAt))),
    // Joined to its order so a test order's refund stays out, as everywhere else on Home.
    tx
      .select({ at: refund.createdAt, amountPaise: refund.amountPaise })
      .from(refund)
      .innerJoin(order, eq(order.id, refund.orderId))
      .where(
        and(
          notTestOrder,
          inArray(refund.status, ['processed', 'manual']),
          gte(refund.createdAt, w.from),
          lt(refund.createdAt, w.to),
        ),
      ),
    // The Abandoned page's definition: a contact, at least one line, quiet for the grace period,
    // and never checked out. (Nothing sets `cart.status = abandoned`, so that filter was always 0.)
    tx
      .select({ at: cart.updatedAt })
      .from(cart)
      .where(
        and(
          ne(cart.status, 'converted'),
          or(isNotNull(cart.email), isNotNull(cart.phone)),
          sql`exists (select 1 from cart_line cl where cl.cart_id = cart.id)`,
          gte(cart.updatedAt, w.from),
          lt(cart.updatedAt, w.to),
          lt(cart.updatedAt, new Date(Date.now() - ABANDONED_AFTER_MS)),
        ),
      ),
  ])
  /* An order is "returning" when its customer had ordered before it. */
  const customerIds = [...new Set(orders.map((o) => o.customerId).filter((id) => id !== null))]
  const firsts = customerIds.length
    ? await tx
        .select({ customerId: order.customerId, first: min(order.placedAt) })
        .from(order)
        .where(and(counted, inArray(order.customerId, customerIds)))
        .groupBy(order.customerId)
    : []
  const firstAt = new Map(firsts.map((f) => [f.customerId, f.first]))
  return { orders, refunds, carts, firstAt }
}

/** Figures for every metric over one window, bucketed by hour (one day) or by day. */
async function figures(
  tx: StoreTx,
  w: Window,
  hourly: boolean,
  visitorsDaily: number[],
): Promise<Record<HomeMetric, { value: number; series: number[] }>> {
  const sessionSeries = await countSessions(tx, w, hourly)
  const n = hourly ? HOURS : w.days.length
  const bucket = (at: Date) =>
    hourly
      ? new Date(at.getTime() + IST_OFFSET_MS).getUTCHours()
      : Math.floor((at.getTime() - w.from.getTime()) / DAY_MS)
  const { orders, refunds, carts, firstAt } = await load(tx, w)
  const series = Object.fromEntries(HOME_METRICS.map((m) => [m, zeros(n)])) as Record<
    HomeMetric,
    number[]
  >
  const cod = zeros(n)
  // Returning = distinct customers who had ordered before, per bucket and over the whole window.
  const returningIn = Array.from({ length: n }, () => new Set<string>())
  const returningAll = new Set<string>()
  for (const o of orders) {
    const i = bucket(o.at)
    if (i < 0 || i >= n) continue
    const add = (m: HomeMetric, v: number) => {
      series[m][i] = (series[m][i] ?? 0) + v
    }
    add('sales', o.totalPaise)
    add('orders', 1)
    add('gross', o.subtotalPaise)
    add('discounts', o.discountPaise)
    add('shipping', o.shippingPaise)
    add('gst', o.taxPaise)
    if (o.paymentMethod === 'cod') cod[i] = (cod[i] ?? 0) + 1
    const first = o.customerId ? firstAt.get(o.customerId) : undefined
    if (o.customerId && first && o.at.getTime() > new Date(first).getTime()) {
      returningIn[i]?.add(o.customerId)
      returningAll.add(o.customerId)
    }
  }
  for (const r of refunds) {
    const i = bucket(r.at)
    if (i >= 0 && i < n) series.refunds[i] = (series.refunds[i] ?? 0) + r.amountPaise
  }
  for (const c of carts) {
    const i = bucket(c.at)
    if (i >= 0 && i < n) series.abandoned[i] = (series.abandoned[i] ?? 0) + 1
  }
  series.returning = returningIn.map((s) => s.size)
  /* Visitors are counted by the day; a single day keeps its total and no hourly line. */
  series.visitors = hourly ? zeros(n) : visitorsDaily.slice(0, n)
  const total = (m: HomeMetric) => series[m].reduce((a, b) => a + b, 0)
  const visitors = hourly ? (visitorsDaily[0] ?? 0) : total('visitors')
  series.sessions = sessionSeries
  const sessions = total('sessions')
  const pct = (part: number, whole: number) =>
    whole > 0 ? Math.round(Math.min(part / whole, 1) * 1000) / 10 : 0
  series.aov = series.sales.map((s, i) => {
    const count = series.orders[i] ?? 0
    return count > 0 ? Math.round(s / count) : 0
  })
  series.codShare = cod.map((c, i) => pct(c, series.orders[i] ?? 0))
  /* Conversion is orders ÷ sessions: per day, or for a single day the running rate by hour. */
  let ordersSoFar = 0
  let sessionsSoFar = 0
  series.conversion = series.orders.map((o, i) => {
    if (!hourly) return pct(o, series.sessions[i] ?? 0)
    ordersSoFar += o
    sessionsSoFar += series.sessions[i] ?? 0
    return pct(ordersSoFar, sessionsSoFar)
  })

  const units = await topUnits(tx, w)
  series.topProducts = units.series(bucket, n)

  const orderCount = total('orders')
  const value: Record<HomeMetric, number> = {
    sales: total('sales'),
    orders: orderCount,
    aov: orderCount > 0 ? Math.round(total('sales') / orderCount) : 0,
    sessions,
    visitors,
    conversion: pct(orderCount, sessions),
    returning: returningAll.size,
    gross: total('gross'),
    refunds: total('refunds'),
    discounts: total('discounts'),
    gst: total('gst'),
    codShare: pct(
      cod.reduce((a, b) => a + b, 0),
      orderCount,
    ),
    abandoned: total('abandoned'),
    shipping: total('shipping'),
    topProducts: units.total,
  }
  return Object.fromEntries(
    HOME_METRICS.map((m) => [m, { value: value[m], series: series[m] }]),
  ) as Record<HomeMetric, { value: number; series: number[] }>
}

/** Units sold in the window: the total, per bucket, and the best seller. */
async function topUnits(tx: StoreTx, w: Window) {
  const lines = await tx
    .select({ at: order.placedAt, quantity: orderLine.quantity, productId: variant.productId })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .where(and(counted, gte(order.placedAt, w.from), lt(order.placedAt, w.to)))
  const total = lines.reduce((n, l) => n + l.quantity, 0)
  return {
    total,
    lines,
    series(bucket: (at: Date) => number, n: number) {
      const out = zeros(n)
      for (const l of lines) {
        const i = bucket(l.at)
        if (i >= 0 && i < n) out[i] = (out[i] ?? 0) + l.quantity
      }
      return out
    },
  }
}

/** The best seller by units in the window, by title. */
async function bestSeller(tx: StoreTx, w: Window) {
  const units = sum(orderLine.quantity).mapWith(Number)
  const [row] = await tx
    .select({ title: product.title, units })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(counted, gte(order.placedAt, w.from), lt(order.placedAt, w.to)))
    .groupBy(product.title)
    .orderBy(desc(units))
    .limit(1)
  return row ? { title: row.title, units: row.units } : null
}

/**
 * Home's analytics card for any date range (Figma 580:692): every metric a tile can show, with
 * its value, its line (by hour for a single day, else by day) and, when comparing, the same for
 * the span before or the same dates a year earlier. Sessions are the beacon's `marketing_session`
 * rows; visitors are its daily unique counts.
 */
export async function homeAnalytics(
  tx: StoreTx,
  opts: {
    from: string
    to: string
    compare: HomeCompare
    storeId?: string
    visitors?: VisitorSource | undefined
  },
): Promise<HomeAnalytics> {
  const first = istDayStart(opts.from)
  const last = istDayStart(opts.to)
  const span = Math.floor((last.getTime() - first.getTime()) / DAY_MS) + 1
  const count = Math.min(HOME_ANALYTICS_MAX_DAYS, Math.max(1, span))
  const current: Window = {
    from: first,
    to: new Date(first.getTime() + count * DAY_MS),
    days: listDays(first, count),
  }
  const hourly = count === 1
  const before = opts.compare === 'none' ? null : comparisonWindow(current, opts.compare)

  const daily = async (days: string[]) =>
    opts.visitors?.daily && opts.storeId
      ? (await opts.visitors.daily(opts.storeId, days)).perDay
      : zeros(days.length)
  const [visitorsNow, visitorsBefore] = await Promise.all([
    daily(current.days),
    before ? daily(before.days) : Promise.resolve(null),
  ])

  // A range still running (Today, this week) is compared with the same elapsed time of the
  // earlier span, not all of it: otherwise every morning reads as a large drop.
  const at = new Date()
  const soFar =
    before && current.to > at
      ? { ...before, to: new Date(before.from.getTime() + (at.getTime() - current.from.getTime())) }
      : null

  const [now, then, thenSoFar, topProduct] = await Promise.all([
    figures(tx, current, hourly, visitorsNow),
    before && visitorsBefore ? figures(tx, before, hourly, visitorsBefore) : Promise.resolve(null),
    soFar && visitorsBefore ? figures(tx, soFar, hourly, visitorsBefore) : Promise.resolve(null),
    bestSeller(tx, current),
  ])

  const metrics = Object.fromEntries(
    HOME_METRICS.map((m) => [
      m,
      {
        value: now[m].value,
        previous: (thenSoFar ?? then)?.[m].value ?? null,
        series: now[m].series,
        previousSeries: then ? then[m].series : null,
      },
    ]),
  ) as Record<HomeMetric, HomeMetricFigures>

  return {
    labels: hourly ? Array.from({ length: HOURS }, (_, h) => String(h)) : current.days,
    hourly,
    metrics,
    topProduct,
  }
}

/** This member's four tile choices for Home; defaults when unset. */
export async function loadHomeTiles(tx: StoreTx, storeId: string, userId: string) {
  const [row] = await tx
    .select({ tiles: storeMember.homeTiles })
    .from(storeMember)
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  return parseHomeTiles(row?.tiles)
}

export async function saveHomeTiles(
  tx: StoreTx,
  storeId: string,
  userId: string,
  tiles: HomeMetric[],
) {
  const parsed = parseHomeTiles(tiles)
  await tx
    .update(storeMember)
    .set({ homeTiles: parsed, updatedAt: new Date() })
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.userId, userId)))
  return parsed
}

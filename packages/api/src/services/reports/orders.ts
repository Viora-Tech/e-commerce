import { order, orderLine } from '@commerce/db'
import { and, eq, sum } from 'drizzle-orm'
import { bucketByDay } from '../analytics-buckets'
import { type OrderFact, orderFacts, refundFacts } from './facts'
import {
  byDesc,
  counted,
  groupBy,
  placedIn,
  type ReportBuilder,
  type ReportRow,
  ratio,
  sumOf,
  withShare,
} from './types'

/** Order statuses in the order an order moves through them. */
const STATUS_ORDER = ['placed', 'paid', 'fulfilled', 'delivered', 'cancelled']

const perDay = (orders: OrderFact[], days: string[], pick: (o: OrderFact) => number = () => 1) =>
  bucketByDay(
    orders.map((o) => ({ at: o.placedAt, weight: pick(o) })),
    days,
  )

export const orderBuilders: Record<string, ReportBuilder> = {
  /**
   * Shopify's finance summary for tax-inclusive Indian prices: GST is already
   * inside gross sales, so it is shown as a breakdown of what was collected,
   * not added on top.
   */
  'gross-to-net': async (tx, span) => {
    const orders = (await orderFacts(tx, span)).filter((o) => !o.cancelled)
    const refunds = await refundFacts(tx, span)
    const gross = sumOf(orders, (o) => o.subtotalPaise)
    const discounts = sumOf(orders, (o) => o.discountPaise)
    const returns = sumOf(refunds, (r) => r.amountPaise)
    const netSales = gross - discounts - returns
    const shipping = sumOf(orders, (o) => o.shippingPaise)
    const fees = sumOf(orders, (o) => o.adjustmentPaise)
    const lines: [string, number][] = [
      ['grossSales', gross],
      ['discounts', -discounts],
      ['returns', -returns],
      ['netSales', netSales],
      ['shipping', shipping],
      ['paymentFees', fees],
      ['totalSales', netSales + shipping + fees],
      ['taxes', sumOf(orders, (o) => o.taxPaise)],
      ['cgst', sumOf(orders, (o) => o.cgstPaise)],
      ['sgst', sumOf(orders, (o) => o.sgstPaise)],
      ['igst', sumOf(orders, (o) => o.igstPaise)],
    ]
    const daily = perDay(orders, span.days, (o) => o.totalPaise)
    const refundsDaily = bucketByDay(
      refunds.map((r) => ({ at: r.at, weight: r.amountPaise })),
      span.days,
    )
    return {
      rows: lines.map(([line, amount]) => ({ key: line, values: { line, amount } })),
      totals: {},
      series: span.days.map((d, i) => ({
        label: d,
        value: (daily[i] ?? 0) - (refundsDaily[i] ?? 0),
      })),
    }
  },

  'orders-over-time': async (tx, span) => {
    const all = await orderFacts(tx, span)
    const orders = all.filter((o) => !o.cancelled)
    const units = await tx
      .select({ orderId: orderLine.orderId, units: sum(orderLine.quantity).mapWith(Number) })
      .from(orderLine)
      .innerJoin(order, eq(order.id, orderLine.orderId))
      .where(and(counted, placedIn(span)))
      .groupBy(orderLine.orderId)
    const unitsByOrder = new Map(units.map((u) => [u.orderId, u.units]))
    const count = perDay(orders, span.days)
    const unitCount = perDay(orders, span.days, (o) => unitsByOrder.get(o.id) ?? 0)
    const cancelled = perDay(
      all.filter((o) => o.cancelled),
      span.days,
    )
    const rows: ReportRow[] = span.days.map((d, i) => ({
      key: d,
      values: {
        day: d,
        orders: count[i] ?? 0,
        units: unitCount[i] ?? 0,
        unitsPerOrder: ratio(unitCount[i] ?? 0, count[i] ?? 0),
        cancelled: cancelled[i] ?? 0,
      },
    }))
    const totalUnits = sumOf(unitCount, (n) => n)
    return {
      rows,
      totals: {
        orders: orders.length,
        units: totalUnits,
        unitsPerOrder: ratio(totalUnits, orders.length),
        cancelled: all.length - orders.length,
      },
    }
  },

  'aov-over-time': async (tx, span) => {
    const orders = (await orderFacts(tx, span)).filter((o) => !o.cancelled)
    const count = perDay(orders, span.days)
    const sales = perDay(orders, span.days, (o) => o.totalPaise)
    const aov = (s: number, n: number) => (n > 0 ? Math.round(s / n) : null)
    const total = sumOf(orders, (o) => o.totalPaise)
    return {
      rows: span.days.map((d, i) => ({
        key: d,
        values: {
          day: d,
          orders: count[i] ?? 0,
          totalSales: sales[i] ?? 0,
          aov: aov(sales[i] ?? 0, count[i] ?? 0),
        },
      })),
      totals: { orders: orders.length, totalSales: total, aov: aov(total, orders.length) },
    }
  },

  'orders-by-status': async (tx, span) => {
    const orders = await orderFacts(tx, span)
    const rows = [...groupBy(orders, (o) => o.status)].map(([status, group]) => ({
      key: status,
      values: {
        status,
        orders: group.length,
        totalSales: sumOf(group, (o) => o.totalPaise),
      },
    }))
    return {
      rows: withShare(rows, 'orders', orders.length).sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.key) - STATUS_ORDER.indexOf(b.key) || byDesc('orders')(a, b),
      ),
      totals: {
        orders: orders.length,
        totalSales: sumOf(orders, (o) => o.totalPaise),
        share: orders.length > 0 ? 1 : null,
      },
    }
  },
}

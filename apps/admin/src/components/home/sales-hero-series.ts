import type { DashboardChartsData, DashboardSummary } from '@commerce/api'
import type { SalesChartPoint } from './sales-hero-chart'

export type Range = 'today' | '7' | '30'
export type Metric = 'sales' | 'orders' | 'visitors' | 'conversion'
/** The comparison pill: against the period before, or nothing (no dashed line, no deltas). */
export type Compare = 'previous' | 'none'

export const METRICS: readonly Metric[] = ['sales', 'orders', 'visitors', 'conversion']

const HOURS = 24

export type SeriesInput = {
  range: Range
  today: DashboardSummary['today']
  yesterdayHourly: number[]
  yesterdayVisitors: number
  charts: DashboardChartsData
  /** Short date labels for the days in range (empty for Today). */
  labels: string[]
}

/** One tile's numbers: the figure for the range, the one before it and the change. */
export type MetricFigures = {
  value: number
  before: number
  /** Percent change (or points for conversion); null when there is nothing to compare. */
  change: number | null
  spark: number[]
}

function sum(values: number[]): number {
  return values.reduce((n, v) => n + v, 0)
}

/** Orders per visitor as a percentage with one decimal; 0 when nobody visited. */
function conversionPercent(orders: number, visitors: number): number {
  if (visitors <= 0) return 0
  return Math.round(Math.min(orders / visitors, 1) * 1000) / 10
}

/** Percent change from `previous` to `current`, rounded; null when there is nothing to compare. */
function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/** A running total, so an hourly series reads as a curve that climbs through the day. */
function cumulative(values: number[]): number[] {
  let total = 0
  return values.map((v) => {
    total += v
    return total
  })
}

/** Today's and yesterday's orders hour by hour; today stops at the current hour. */
function hourlyPoints(today: number[], yesterday: number[]): SalesChartPoint[] {
  const now = cumulative(today)
  const before = cumulative(yesterday)
  return Array.from({ length: HOURS }, (_, h) => ({
    label: `${h}:00`,
    value: h < now.length ? (now[h] ?? 0) : null,
    before: before[h] ?? null,
  }))
}

/** Daily values for the days in range, with the matching earlier stretch dashed behind. */
function dailyPoints(current: number[], previous: number[], labels: string[]): SalesChartPoint[] {
  return labels.map((label, i) => ({
    label,
    value: current[i] ?? 0,
    before: previous[i] ?? null,
  }))
}

/** The days in range and the stretch before them, per daily series. */
function windows(input: SeriesInput) {
  const { range, charts } = input
  const days = range === '7' ? 7 : 30
  const cut = (all: number[]) => all.slice(-days)
  const before7 = (all: number[]) => all.slice(-14, -7)
  return {
    days,
    sales: cut(charts.salesPaise),
    salesBefore: range === '7' ? before7(charts.salesPaise) : (charts.previousSalesPaise ?? []),
    orders: cut(charts.orders),
    ordersBefore: range === '7' ? before7(charts.orders) : [],
    visitors: cut(charts.visitors),
    visitorsBefore: range === '7' ? before7(charts.visitors) : charts.previousVisitors,
  }
}

/** Every tile's figures for the range (Total sales, Orders, Visitors, Conversion rate). */
export function metricFigures(input: SeriesInput, livePerMinute: number[]) {
  const { range, today, yesterdayHourly, yesterdayVisitors, charts } = input
  const w = windows(input)
  const isToday = range === 'today'

  const salesValue = isToday ? today.salesPaise : sum(w.sales)
  const salesBefore = isToday ? (charts.salesPaise.at(-2) ?? 0) : sum(w.salesBefore)
  const ordersValue = isToday ? today.ordersCount : sum(w.orders)
  const ordersBefore = isToday ? sum(yesterdayHourly) : sum(w.ordersBefore)
  const visitorsValue = isToday ? today.visitors : sum(w.visitors)
  const visitorsBefore = isToday ? yesterdayVisitors : sum(w.visitorsBefore)
  const conversion = conversionPercent(ordersValue, visitorsValue)
  const conversionBefore = conversionPercent(ordersBefore, visitorsBefore)

  const figures: Record<Metric, MetricFigures> = {
    sales: {
      value: salesValue,
      before: salesBefore,
      change: percentChange(salesValue, salesBefore),
      spark: isToday ? cumulative(today.hourly) : w.sales,
    },
    orders: {
      value: ordersValue,
      before: ordersBefore,
      change: range === '30' ? null : percentChange(ordersValue, ordersBefore),
      spark: isToday ? cumulative(today.hourly) : w.orders,
    },
    visitors: {
      value: visitorsValue,
      before: visitorsBefore,
      change: percentChange(visitorsValue, visitorsBefore),
      spark: isToday ? livePerMinute : w.visitors,
    },
    conversion: {
      value: conversion,
      before: conversionBefore,
      change:
        range === '30' || visitorsBefore <= 0
          ? null
          : Math.round((conversion - conversionBefore) * 10) / 10,
      spark: isToday ? [] : w.orders.map((n, i) => conversionPercent(n, w.visitors[i] ?? 0)),
    },
  }
  return figures
}

/**
 * The chart's points for the picked metric. Today is hour by hour (orders and sales share the
 * hourly order curve; visitors are not kept by the hour, so Visitors and Conversion are empty
 * on Today and the chart says to pick 7 or 30 days). With no comparison the dashed line goes.
 */
export function chartPoints(input: SeriesInput, metric: Metric, compare: Compare) {
  const { range, today, yesterdayHourly, labels } = input
  let points: SalesChartPoint[]
  if (range === 'today') {
    points =
      metric === 'sales' || metric === 'orders' ? hourlyPoints(today.hourly, yesterdayHourly) : []
  } else {
    const w = windows(input)
    const rate = (orders: number[], visitors: number[]) =>
      orders.map((n, i) => conversionPercent(n, visitors[i] ?? 0))
    const series: Record<Metric, [number[], number[]]> = {
      sales: [w.sales, w.salesBefore],
      orders: [w.orders, w.ordersBefore],
      visitors: [w.visitors, w.visitorsBefore],
      conversion: [rate(w.orders, w.visitors), rate(w.ordersBefore, w.visitorsBefore)],
    }
    const [current, previous] = series[metric]
    points = dailyPoints(current, previous, labels)
  }
  return compare === 'none' ? points.map((p) => ({ ...p, before: null })) : points
}

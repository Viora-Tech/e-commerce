'use client'

import type { DashboardChartsData, DashboardSummary } from '@commerce/api'
import { ArrowRight, Pencil } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { homePageContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import SalesHeroChart, { type SalesChartPoint } from './sales-hero-chart'
import SalesMetricTiles from './sales-metric-tiles'

type SalesHeroProps = {
  today: DashboardSummary['today']
  yesterdayHourly: number[]
  /** The 30-day daily series; the last entry is today. Every range is cut from it. */
  charts: DashboardChartsData
  /** Visitors on the store right now (the beacon's last-30-minutes count). */
  liveNow: number
  /** Visitors per minute, oldest first, for the visitors sparkline. */
  livePerMinute: number[]
}

type Range = 'today' | '7' | '30'

type Metric = 'sales' | 'orders'

const HOURS = 24
const SHORT_DATE_OPTIONS = { day: 'numeric', month: 'short' } as const

const sum = (values: number[]) => values.reduce((n, v) => n + v, 0)

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

/** Daily values for the last `days` days, with the matching earlier stretch dashed behind. */
function dailyPoints(
  values: number[],
  previous: number[],
  days: number,
  labels: string[],
): SalesChartPoint[] {
  return labels.map((label, i) => {
    const index = values.length - days + i
    return {
      label,
      value: values[index] ?? 0,
      before: previous[i] ?? null,
    }
  })
}

/**
 * The sales hero: filter pills, the live count and Customize, one tile per metric with its
 * own sparkline and delta, and the area chart (Today solid, before dashed). The Today /
 * 7 days / 30 days switch cuts the one 30-day series Home already loaded, so switching
 * never refetches. Visit counts are not recorded per day, so the visitors tile shows the
 * live count instead of a daily total.
 */
export default function SalesHero({
  today,
  yesterdayHourly,
  charts,
  liveNow,
  livePerMinute,
}: SalesHeroProps) {
  // Hooks
  const content = useCopy(homePageContent)
  const fmt = useFormat()
  const [range, setRange] = useState<Range>('today')
  const [metric, setMetric] = useState<Metric>('sales')

  // Helpers
  const formatValue = (v: number) => (metric === 'sales' ? fmt.money(v) : fmt.compact(v))
  const formatTooltip = (v: number) =>
    range === 'today' ? String(v) : metric === 'sales' ? fmt.money(v) : fmt.compact(v)

  // Event handlers
  const handleRange = (next: Range) => {
    setRange(next)
  }

  const handleMetric = (next: Metric) => {
    setMetric(next)
  }

  // Render logic
  const copy = content.sales
  const all = charts.salesPaise
  const ordersAll = charts.orders
  const days = range === '7' ? 7 : 30
  const comparedTo = range === 'today' ? copy.vsYesterday : copy.vsPrevious(days)

  const salesValue = range === 'today' ? today.salesPaise : sum(all.slice(-days))
  const salesPrevious = range === '7' ? all.slice(-14, -7) : (charts.previousSalesPaise ?? [])
  const salesBefore = range === 'today' ? (all[all.length - 2] ?? 0) : sum(salesPrevious)
  const salesChange = percentChange(salesValue, salesBefore)

  const ordersValue = range === 'today' ? today.ordersCount : sum(ordersAll.slice(-days))
  const ordersBefore =
    range === 'today' ? sum(yesterdayHourly) : sum(range === '7' ? ordersAll.slice(-14, -7) : [])
  const ordersChange = range === '30' ? null : percentChange(ordersValue, ordersBefore)

  const labels =
    range === 'today'
      ? []
      : charts.days
          .slice(-days)
          .map((day) => fmt.pattern(new Date(`${day}T00:00:00+05:30`), SHORT_DATE_OPTIONS))
  const points =
    range === 'today'
      ? hourlyPoints(today.hourly, yesterdayHourly)
      : metric === 'sales'
        ? dailyPoints(all, salesPrevious, days, labels)
        : dailyPoints(ordersAll, range === '7' ? ordersAll.slice(-14, -7) : [], days, labels)

  const valueLabel =
    metric === 'sales'
      ? range === 'today'
        ? copy.series.today
        : copy.series.sales
      : copy.ordersTitle
  const beforeLabel =
    range === 'today'
      ? copy.series.yesterday
      : metric === 'sales'
        ? copy.series.before
        : copy.vsPrevious(days)
  const valueText = formatValue(metric === 'sales' ? salesValue : ordersValue)
  const beforeText = formatValue(metric === 'sales' ? salesBefore : ordersBefore)

  const tabs = [
    { value: 'today' as Range, label: copy.today },
    { value: '7' as Range, label: copy.days7 },
    { value: '30' as Range, label: copy.days30 },
  ]

  return (
    <section className="flex flex-col gap-5 rounded-xl surface-card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={copy.title}>
          {tabs.map((tab) => {
            const active = tab.value === range
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleRange(tab.value)}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-secondary text-ink-strong'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            )
          })}
          <span className="inline-flex h-8 items-center text-body text-muted-foreground">
            {comparedTo}
          </span>
          <span className="inline-flex h-8 items-center text-body text-muted-foreground">
            {copy.channels}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 pr-1 text-body text-muted-foreground">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            {copy.liveNow(liveNow)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={routes.analytics.home()} />}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {copy.customize}
          </Button>
        </div>
      </div>
      <SalesMetricTiles
        salesDisplay={fmt.money(salesValue)}
        salesSpark={range === 'today' ? cumulative(today.hourly) : all.slice(-days)}
        salesChange={salesChange}
        ordersDisplay={fmt.compact(ordersValue)}
        ordersSpark={range === 'today' ? cumulative(today.hourly) : ordersAll.slice(-days)}
        ordersChange={ordersChange}
        visitorsDisplay={fmt.compact(liveNow)}
        visitorsSpark={livePerMinute}
        comparedTo={comparedTo}
        totalSales={copy.totalSales}
        ordersTitle={copy.ordersTitle}
        visitorsTitle={copy.visitorsTitle}
        visitorsNow={copy.visitorsNow}
        metric={metric}
        onSelect={handleMetric}
      />
      <div className="min-w-0">
        <SalesHeroChart
          points={points}
          valueLabel={valueLabel}
          beforeLabel={beforeLabel}
          emptyText={copy.empty}
          swapKey={`${range}-${metric}`}
          formatTooltip={formatTooltip}
          formatTick={(v) => fmt.compact(v)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" />
            {valueLabel}
            <strong className="font-semibold text-ink-strong tabular-nums">{valueText}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-0 w-4 border-t-2 border-dashed border-muted-foreground"
              aria-hidden="true"
            />
            {beforeLabel}
            <strong className="font-semibold text-ink-strong tabular-nums">{beforeText}</strong>
          </span>
        </p>
        <Link
          href={routes.analytics.reports()}
          className="inline-flex items-center gap-1 text-body font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copy.viewReport}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

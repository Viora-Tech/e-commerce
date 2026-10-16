'use client'

import type { DashboardChartsData, DashboardSummary } from '@commerce/api'
import { ArrowLeftRight, ArrowRight, ChevronDown, Clock, Pencil, Store } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { useState } from 'react'
import { homePageContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import HeroGlass from './hero-glass'
import SalesHeroChart, { type SalesChartPoint } from './sales-hero-chart'
import SalesMetricTiles from './sales-metric-tiles'

type SalesHeroProps = {
  today: DashboardSummary['today']
  yesterdayHourly: number[]
  /** Storefront visitors yesterday (IST), the Today comparison for Visitors and Conversion. */
  yesterdayVisitors: number
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

/** Figma "Analytics · Filter button" (580:694): 32px pill, 14px lead icon, 13/20 medium. */
const PILL =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-glass-border bg-background/60 pr-2 pl-2.5 text-[0.8125rem] leading-5 font-medium whitespace-nowrap text-foreground shadow-lift [&_svg]:size-3.5 [&_svg]:shrink-0'

const sum = (values: number[]) => values.reduce((n, v) => n + v, 0)

/** Percent change from `previous` to `current`, rounded; null when there is nothing to compare. */
/** Orders per visitor as a percentage with one decimal; 0 when nobody visited. */
function conversionPercent(orders: number, visitors: number): number {
  if (visitors <= 0) return 0
  return Math.round(Math.min(orders / visitors, 1) * 1000) / 10
}

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
 * never refetches. Visitors come from the beacon's daily counts; Conversion rate is orders per
 * visitor for the same window, its change in percentage points.
 */
export default function SalesHero({
  today,
  yesterdayHourly,
  yesterdayVisitors,
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
  const handleRange = (next: unknown) => {
    if (next === 'today' || next === '7' || next === '30') setRange(next)
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

  const visitorsAll = charts.visitors
  const visitorsValue = range === 'today' ? today.visitors : sum(visitorsAll.slice(-days))
  const visitorsBefore =
    range === 'today'
      ? yesterdayVisitors
      : sum(range === '7' ? visitorsAll.slice(-14, -7) : charts.previousVisitors)
  const visitorsChange = percentChange(visitorsValue, visitorsBefore)
  const conversion = conversionPercent(ordersValue, visitorsValue)
  const conversionBefore = conversionPercent(ordersBefore, visitorsBefore)
  const conversionChange =
    range === '30' || visitorsBefore <= 0
      ? null
      : Math.round((conversion - conversionBefore) * 10) / 10
  const conversionSpark =
    range === 'today'
      ? []
      : ordersAll.slice(-days).map((n, i) => conversionPercent(n, visitorsAll.slice(-days)[i] ?? 0))

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
    <section className="relative isolate flex flex-col overflow-hidden rounded-xl surface-glass">
      <HeroGlass />
      <div className="flex flex-wrap items-center gap-2 pt-4 pr-4 pb-2 pl-5">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={copy.title}
            className={`${PILL} cursor-pointer transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted`}
          >
            <Clock aria-hidden="true" />
            {tabs.find((tab) => tab.value === range)?.label}
            <ChevronDown className="text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-36">
            <DropdownMenuRadioGroup value={range} onValueChange={handleRange}>
              {tabs.map((tab) => (
                <DropdownMenuRadioItem key={tab.value} value={tab.value} closeOnClick>
                  {tab.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className={PILL}>
          <ArrowLeftRight aria-hidden="true" />
          {comparedTo}
        </span>
        <span className={PILL}>
          <Store aria-hidden="true" />
          {copy.channels}
        </span>
        <span className="flex-1" aria-hidden="true" />
        <span className="inline-flex items-center gap-2 pr-2 text-[0.8125rem] leading-5 font-medium text-foreground">
          <span className="flex size-3.5 items-center justify-center" aria-hidden="true">
            <span className="size-2 rounded-full bg-foreground ring-3 ring-foreground/15" />
          </span>
          {copy.liveNow(liveNow)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.analytics.home()} />}
        >
          <Pencil className="size-4" aria-hidden="true" />
          {copy.customize}
        </Button>
      </div>
      <div className="px-3 py-1">
        <SalesMetricTiles
          salesDisplay={fmt.money(salesValue)}
          salesSpark={range === 'today' ? cumulative(today.hourly) : all.slice(-days)}
          salesChange={salesChange}
          ordersDisplay={fmt.compact(ordersValue)}
          ordersSpark={range === 'today' ? cumulative(today.hourly) : ordersAll.slice(-days)}
          ordersChange={ordersChange}
          visitorsDisplay={fmt.compact(visitorsValue)}
          visitorsSpark={range === 'today' ? livePerMinute : visitorsAll.slice(-days)}
          visitorsChange={visitorsChange}
          conversionDisplay={`${fmt.number(conversion)}%`}
          conversionSpark={conversionSpark}
          conversionChange={conversionChange}
          conversionTitle={copy.conversionTitle}
          points={copy.points}
          comparedTo={comparedTo}
          totalSales={copy.totalSales}
          ordersTitle={copy.ordersTitle}
          visitorsTitle={copy.visitorsTitle}
          metric={metric}
          onSelect={handleMetric}
        />
      </div>
      <div className="min-w-0 px-5 pt-3">
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3 pb-4">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.8125rem] leading-5 text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-3.5 rounded-full bg-primary" aria-hidden="true" />
            {valueLabel}
            <strong className="font-semibold text-ink-strong tabular-nums">{valueText}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground"
              aria-hidden="true"
            />
            {beforeLabel}
            <strong className="font-semibold text-ink-strong tabular-nums">{beforeText}</strong>
          </span>
        </p>
        <Link
          href={routes.analytics.reports()}
          className="inline-flex items-center gap-1 text-[0.8125rem] leading-5 font-medium text-foreground transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copy.viewReport}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

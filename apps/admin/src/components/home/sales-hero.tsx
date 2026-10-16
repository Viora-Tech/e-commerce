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
import SalesHeroChart from './sales-hero-chart'
import {
  type Compare,
  chartPoints,
  METRICS,
  type Metric,
  metricFigures,
  type Range,
} from './sales-hero-series'
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

const SHORT_DATE_OPTIONS = { day: 'numeric', month: 'short' } as const

/** Figma "Analytics · Filter button" (580:694): 32px pill, 14px lead icon, 13/20 medium. */
const PILL =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-glass-border bg-background/60 pr-2 pl-2.5 text-[0.8125rem] leading-5 font-medium whitespace-nowrap text-foreground shadow-lift [&_svg]:size-3.5 [&_svg]:shrink-0'
const MENU_PILL = `${PILL} cursor-pointer transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted`

/**
 * The sales hero: filter pills, the live count and Customize, one tile per metric with its
 * own sparkline and delta, and the area chart (current solid, before dashed). Every tile is
 * selectable and the chart follows it (Total sales, Orders, Visitors, Conversion rate); the
 * range (Today / 7 / 30 days) and the comparison (the period before, or none) are menus. All
 * of it is cut from the one 30-day series Home already loaded, so nothing refetches.
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
  const [compare, setCompare] = useState<Compare>('previous')

  // Helpers
  const formatFor = (m: Metric, v: number) =>
    m === 'sales' ? fmt.money(v) : m === 'conversion' ? `${fmt.number(v)}%` : fmt.compact(v)
  const formatTooltip = (v: number) =>
    range === 'today' && metric !== 'sales' ? String(v) : formatFor(metric, v)

  // Event handlers
  const handleRange = (next: unknown) => {
    if (next === 'today' || next === '7' || next === '30') setRange(next)
  }

  const handleCompare = (next: unknown) => {
    if (next === 'previous' || next === 'none') setCompare(next)
  }

  const handleMetric = (next: Metric) => {
    setMetric(next)
  }

  // Render logic
  const copy = content.sales
  const days = range === '7' ? 7 : 30
  const comparedTo = range === 'today' ? copy.vsYesterday : copy.vsPrevious(days)
  const labels =
    range === 'today'
      ? []
      : charts.days
          .slice(-days)
          .map((day) => fmt.pattern(new Date(`${day}T00:00:00+05:30`), SHORT_DATE_OPTIONS))
  const input = { range, today, yesterdayHourly, yesterdayVisitors, charts, labels }
  const figures = metricFigures(input, livePerMinute)
  const points = chartPoints(input, metric, compare)
  const comparing = compare === 'previous'
  const picked = figures[metric]

  const titles: Record<Metric, string> = {
    sales: range === 'today' ? copy.series.today : copy.series.sales,
    orders: copy.ordersTitle,
    visitors: copy.visitorsTitle,
    conversion: copy.conversionTitle,
  }
  const valueLabel = titles[metric]
  const beforeLabel =
    range === 'today'
      ? copy.series.yesterday
      : metric === 'sales'
        ? copy.series.before
        : copy.vsPrevious(days)
  /* Visitors are not kept by the hour, so their Today chart asks for a longer range. */
  const emptyText =
    range === 'today' && (metric === 'visitors' || metric === 'conversion')
      ? copy.noHourly
      : metric === 'visitors' || metric === 'conversion'
        ? copy.emptyVisitors
        : copy.empty
  const valueText = formatFor(metric, picked.value)
  const beforeText = formatFor(metric, picked.before)

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
          <DropdownMenuTrigger aria-label={copy.title} className={MENU_PILL}>
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
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={copy.compareLabel} className={MENU_PILL}>
            <ArrowLeftRight aria-hidden="true" />
            {comparing ? comparedTo : copy.noCompare}
            <ChevronDown className="text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuRadioGroup value={compare} onValueChange={handleCompare}>
              <DropdownMenuRadioItem value="previous" closeOnClick>
                {comparedTo}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="none" closeOnClick>
                {copy.noCompare}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
          tiles={METRICS.map((m) => ({
            metric: m,
            label: m === 'sales' ? copy.totalSales : titles[m],
            display: formatFor(m, figures[m].value),
            spark: figures[m].spark,
            change: comparing ? figures[m].change : null,
            unit: m === 'conversion' ? ` ${copy.points}` : '%',
          }))}
          comparedTo={comparedTo}
          metric={metric}
          onSelect={handleMetric}
        />
      </div>
      <div className="min-w-0 px-5 pt-3">
        <SalesHeroChart
          points={points}
          valueLabel={valueLabel}
          beforeLabel={beforeLabel}
          emptyText={emptyText}
          swapKey={`${range}-${metric}-${compare}`}
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
          {comparing ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground"
                aria-hidden="true"
              />
              {beforeLabel}
              <strong className="font-semibold text-ink-strong tabular-nums">{beforeText}</strong>
            </span>
          ) : null}
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

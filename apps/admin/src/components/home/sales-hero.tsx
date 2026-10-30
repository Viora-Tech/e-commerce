'use client'

import type { HomeAnalytics } from '@commerce/api'
import type { HomeMetric } from '@commerce/core/home-metrics'
import { ArrowLeftRight, ArrowRight, CheckIcon, ChevronDown, Pencil } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import DateRangePicker from '@/components/layout/date-range-picker'
import { homePageContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { HomeRange, RangeCompare } from '@/lib/home-range'
import { routes } from '@/lib/routes'
import ChannelMenu, { type Channel } from './analytics/channel-menu'
import {
  formatMetric,
  formatTick,
  METRIC_META,
  metricChange,
  shapeHourly,
} from './analytics/metric-meta'
import HeroGlass from './hero-glass'
import SalesHeroChart, { type SalesChartPoint } from './sales-hero-chart'
import SalesMetricTiles from './sales-metric-tiles'

type SalesHeroProps = {
  /** Today's numbers, rendered on the server so the card never paints empty. */
  initial: { range: HomeRange; analytics: HomeAnalytics; tiles: HomeMetric[] }
  /** Visitors on the store right now (the beacon's last-30-minutes count). */
  liveNow: number
}

const SHORT_DATE_OPTIONS = { day: 'numeric', month: 'short' } as const

/** Figma "Analytics · Filter button" (580:694): 32px pill, 14px lead icon, 13/20 medium. */
const PILL =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-glass-border bg-background/60 pr-2 pl-2.5 text-[0.8125rem] leading-5 font-medium whitespace-nowrap text-foreground shadow-lift [&_svg]:size-3.5 [&_svg]:shrink-0'
const MENU_PILL = `${PILL} cursor-pointer transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted`

/** The chart's points for one metric: hour by hour for a single day (running totals), else by day. */
function pointsFor(
  data: HomeAnalytics,
  metric: HomeMetric,
  dayLabel: (iso: string) => string,
): SalesChartPoint[] {
  const figures = data.metrics[metric]
  /* Visitors are counted by the day, so a single day has no visitor line. */
  if (data.hourly && metric === 'visitors') return []
  const shape = (values: number[]) => (data.hourly ? shapeHourly(metric, values) : values)
  const now = shape(figures.series)
  const before = figures.previousSeries ? shape(figures.previousSeries) : null
  return data.labels.map((label, i) => ({
    label: data.hourly ? `${label}:00` : dayLabel(label),
    value: now[i] ?? 0,
    before: before ? (before[i] ?? null) : null,
  }))
}

/** The tile whose chart opens: Total sales when it is on show, else the first tile. */
function openingMetric(tiles: HomeMetric[]): HomeMetric {
  return tiles.includes('sales') ? 'sales' : (tiles[0] ?? 'sales')
}

/**
 * The Home analytics card (Figma 580:692): the range picker (presets, calendar, compare), the
 * channels menu, the live count and Customize; four tiles whose metrics each member picks; the
 * chart for the selected tile (current solid, comparison dashed) and its legend. Changing the
 * range or comparison refetches `dashboard.analytics`; the tile choice is saved per member.
 */
export default function SalesHero({ initial, liveNow }: SalesHeroProps) {
  // Hooks
  const content = useCopy(homePageContent)
  const fmt = useFormat()
  const [range, setRange] = useState(initial.range)
  const [compare, setCompare] = useState<RangeCompare>('previous')
  const [channel, setChannel] = useState<Channel>('all')
  const [data, setData] = useState(initial.analytics)
  const [loading, setLoading] = useState(false)
  const [tiles, setTiles] = useState(initial.tiles)
  const [metric, setMetric] = useState<HomeMetric>(openingMetric(initial.tiles))
  const [customizing, setCustomizing] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    // The server already rendered the opening range.
    if (first.current) {
      first.current = false
      return
    }
    let live = true
    setLoading(true)
    api.dashboard
      .analytics({ from: range.from, to: range.to, compare })
      .then((next) => live && setData(next))
      .catch(() => live && toast.error(content.sales.loadFailed))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [range.from, range.to, compare, content.sales.loadFailed])

  // Helpers
  const dayLabel = (iso: string) =>
    fmt.pattern(new Date(`${iso}T00:00:00+05:30`), SHORT_DATE_OPTIONS)

  // Event handlers
  const handleApply = (next: HomeRange, nextCompare: RangeCompare) => {
    setRange(next)
    setCompare(nextCompare)
  }

  const handleCompare = (next: unknown) => {
    if (next === 'previous' || next === 'year' || next === 'none') setCompare(next)
  }

  const handleSwap = (slot: number, picked: HomeMetric) => {
    const next = [...tiles]
    /* A metric lives in one slot: picking one already shown swaps the two. */
    const already = next.indexOf(picked)
    if (already >= 0) next[already] = next[slot] ?? picked
    next[slot] = picked
    setTiles(next)
    if (!next.includes(metric)) setMetric(openingMetric(next))
    api.dashboard.setTiles({ tiles: next }).catch(() => toast.error(content.sales.tilesSaveFailed))
  }

  // Render logic
  const copy = content.sales
  const comparing = compare !== 'none'
  const singleDay = range.from === range.to
  const comparedTo = compare === 'year' ? copy.vsYear : singleDay ? copy.vsYesterday : copy.vsPeriod
  const picked = data.metrics[metric]
  const points = pointsFor(data, metric, dayLabel)
  const valueLabel = singleDay && metric === 'sales' ? copy.series.today : copy.metrics[metric]
  const beforeLabel =
    compare === 'year' ? copy.vsYear : singleDay ? copy.series.yesterday : copy.vsPeriod
  const emptyText =
    data.hourly && metric === 'visitors'
      ? copy.noHourly
      : metric === 'sessions' || metric === 'visitors' || metric === 'conversion'
        ? copy.emptyVisitors
        : copy.empty

  return (
    <section
      aria-busy={loading}
      className="relative isolate flex flex-col overflow-hidden rounded-xl surface-glass"
    >
      <HeroGlass />
      <div className="flex flex-wrap items-center gap-2 pt-4 pr-4 pb-2 pl-5">
        <DateRangePicker
          range={range}
          compare={compare}
          onApply={handleApply}
          className={MENU_PILL}
        />
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={copy.compareLabel} className={MENU_PILL}>
            <ArrowLeftRight aria-hidden="true" />
            {comparing ? comparedTo : copy.noCompare}
            <ChevronDown className="text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-48">
            <DropdownMenuRadioGroup value={compare} onValueChange={handleCompare}>
              <DropdownMenuRadioItem value="previous" closeOnClick>
                {singleDay ? copy.vsYesterday : copy.vsPeriod}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="year" closeOnClick>
                {copy.vsYear}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="none" closeOnClick>
                {copy.noCompare}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChannelMenu value={channel} onChange={setChannel} className={MENU_PILL} />
        <span className="flex-1" aria-hidden="true" />
        <span className="inline-flex items-center gap-2 pr-2 text-[0.8125rem] leading-5 font-medium text-foreground">
          <span className="flex size-3.5 items-center justify-center" aria-hidden="true">
            <span className="size-2 rounded-full bg-foreground ring-3 ring-foreground/15" />
          </span>
          {copy.liveNow(liveNow)}
        </span>
        <Button
          variant={customizing ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setCustomizing((c) => !c)}
          aria-pressed={customizing}
        >
          {customizing ? (
            <CheckIcon className="size-4" aria-hidden="true" />
          ) : (
            <Pencil className="size-4" aria-hidden="true" />
          )}
          {customizing ? copy.done : copy.customize}
        </Button>
      </div>
      {customizing ? (
        <p className="px-5 pb-1 text-xs text-muted-foreground">{copy.customizeHint}</p>
      ) : null}
      <div
        className={cn(
          'px-3 py-1 transition-opacity duration-200 ease-out',
          loading && 'opacity-60',
        )}
      >
        <SalesMetricTiles
          tiles={tiles.map((m) => ({
            metric: m,
            label: copy.metrics[m],
            display: formatMetric(fmt, m, data.metrics[m].value),
            spark: data.metrics[m].series,
            change: comparing
              ? metricChange(m, data.metrics[m].value, data.metrics[m].previous)
              : null,
            unit: METRIC_META[m].kind === 'percent' ? ` ${copy.points}` : '%',
            lowerIsBetter: METRIC_META[m].lowerIsBetter,
            note:
              m === 'topProducts' && data.topProduct
                ? copy.bestSeller(data.topProduct.title)
                : undefined,
          }))}
          comparedTo={comparedTo}
          metric={metric}
          onSelect={setMetric}
          customizing={customizing}
          onSwap={handleSwap}
        />
      </div>
      <div
        className={cn('min-w-0 px-5 pt-3 transition-opacity duration-200', loading && 'opacity-60')}
      >
        <SalesHeroChart
          points={points}
          valueLabel={valueLabel}
          beforeLabel={beforeLabel}
          emptyText={emptyText}
          swapKey={`${range.from}-${range.to}-${metric}-${compare}`}
          formatTooltip={(v) => formatMetric(fmt, metric, v)}
          formatTick={(v) => formatTick(fmt, metric, v)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3 pb-4">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.8125rem] leading-5 text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-3.5 rounded-full bg-primary" aria-hidden="true" />
            {valueLabel}
            <strong className="font-semibold text-ink-strong tabular-nums">
              {formatMetric(fmt, metric, picked.value)}
            </strong>
          </span>
          {comparing && picked.previous !== null ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground"
                aria-hidden="true"
              />
              {beforeLabel}
              <strong className="font-semibold text-ink-strong tabular-nums">
                {formatMetric(fmt, metric, picked.previous)}
              </strong>
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

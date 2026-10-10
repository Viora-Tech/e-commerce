'use client'

import type { DashboardChartsData, DashboardSummary } from '@commerce/api'
import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { useState } from 'react'
import { Area, AreaChart, Line, XAxis } from 'recharts'
import PillTabs from '@/components/layout/pill-tabs'
import { homePageContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { Formatters } from '@/lib/format'

type SalesHeroProps = {
  today: DashboardSummary['today']
  yesterdayHourly: number[]
  /** The 30-day daily series; the last entry is today. Every range is cut from it. */
  charts: DashboardChartsData
}

type Range = 'today' | '7' | '30'

type Point = { label: string; value: number | null; before: number | null }

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
function hourlyPoints(today: number[], yesterday: number[]): Point[] {
  const now = cumulative(today)
  const before = cumulative(yesterday)
  return Array.from({ length: HOURS }, (_, h) => ({
    label: `${h}:00`,
    value: h < now.length ? (now[h] ?? 0) : null,
    before: before[h] ?? null,
  }))
}

/** Daily sales for the last `days` days, with the `days` before them dashed behind. */
function dailyPoints(charts: DashboardChartsData, days: number, fmt: Formatters): Point[] {
  const all = charts.salesPaise
  const labels = charts.days.slice(-days)
  const previous = charts.previousSalesPaise
  return labels.map((day, i) => {
    const index = all.length - days + i
    const before = index - days >= 0 ? all[index - days] : previous?.[all.length + index - days]
    return {
      label: fmt.pattern(new Date(`${day}T00:00:00+05:30`), SHORT_DATE_OPTIONS),
      value: all[index] ?? 0,
      before: before ?? null,
    }
  })
}

/**
 * The sales hero: today's takings as the big number, how that compares with yesterday, and
 * an area chart. The Today / 7 days / 30 days switch cuts the one 30-day series Home already
 * loaded, so switching never refetches. Visit counts are not recorded per day, so the line
 * under the number carries orders only.
 */
export default function SalesHero({ today, yesterdayHourly, charts }: SalesHeroProps) {
  // Hooks
  const content = useCopy(homePageContent)
  const fmt = useFormat()
  const [range, setRange] = useState<Range>('today')

  // Render logic
  const copy = content.sales
  const all = charts.salesPaise
  const days = range === '7' ? 7 : 30
  let value = today.salesPaise
  let orders = today.ordersCount
  let change: number | null = percentChange(today.salesPaise, all[all.length - 2] ?? 0)
  let comparedTo = copy.vsYesterday
  let points = hourlyPoints(today.hourly, yesterdayHourly)
  let title = copy.title
  if (range !== 'today') {
    const current = all.slice(-days)
    const previous = days === 7 ? all.slice(-14, -7) : (charts.previousSalesPaise ?? [])
    value = sum(current)
    orders = sum(charts.orders.slice(-days))
    change = percentChange(value, sum(previous))
    comparedTo = copy.vsPrevious(days)
    points = dailyPoints(charts, days, fmt)
    title = copy.titleDays(days)
  }
  const hasData = points.some((p) => (p.value ?? 0) > 0 || (p.before ?? 0) > 0)
  const up = (change ?? 0) >= 0
  const config = {
    value: {
      label: range === 'today' ? copy.series.today : copy.series.sales,
      color: 'var(--primary)',
    },
    before: {
      label: range === 'today' ? copy.series.yesterday : copy.series.before,
      color: 'var(--muted-foreground)',
    },
  } satisfies ChartConfig
  const tabs = [
    { value: 'today' as Range, label: copy.today },
    { value: '7' as Range, label: copy.days7 },
    { value: '30' as Range, label: copy.days30 },
  ]

  return (
    <section className="grid grid-cols-1 gap-6 rounded-xl surface-card p-[1.875rem] md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
      <div className="flex flex-col items-start gap-1.5">
        <p className="text-[0.8125rem] leading-[1.1875rem] font-medium text-muted-foreground">
          {title}
        </p>
        <p className="font-[family-name:var(--font-display)] text-[3.5rem] leading-[3.75rem] font-extrabold tracking-[-0.1rem] text-ink-strong tabular-nums">
          {fmt.money(value)}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
          {change !== null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-[0.5rem] px-2 py-[0.1875rem] text-xs font-semibold',
                up ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
              )}
            >
              {up ? (
                <ArrowUp className="size-3" aria-hidden="true" />
              ) : (
                <ArrowDown className="size-3" aria-hidden="true" />
              )}
              {Math.abs(change)}%
            </span>
          ) : null}
          {change !== null ? <span>{comparedTo}</span> : null}
          <span>
            {change !== null ? '· ' : ''}
            {copy.orders(orders)}
          </span>
        </p>
        <PillTabs variant="segmented" tabs={tabs} value={range} onChange={setRange} />
      </div>
      <div className="min-w-0">
        {hasData ? (
          <ChartContainer config={config} className="aspect-auto h-40 w-full">
            <AreaChart data={points} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="home-hero-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <ChartTooltip
                cursor={{ stroke: 'var(--primary)', strokeDasharray: '4 4' }}
                content={
                  <ChartTooltipContent
                    formatter={(v, name) => (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {config[name as keyof typeof config]?.label}
                        </span>
                        <span className="font-bold tabular-nums">
                          {range === 'today' ? String(v) : fmt.money(Number(v))}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Line
                dataKey="before"
                type="monotone"
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Area
                dataKey="value"
                type="monotone"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#home-hero-fill)"
                isAnimationActive={false}
                connectNulls={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        )}
        {hasData && range === 'today' ? (
          <p className="mt-1 text-caption font-normal text-muted-foreground">{copy.hourlyNote}</p>
        ) : null}
      </div>
    </section>
  )
}

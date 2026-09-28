'use client'

import type { DashboardChartsData } from '@commerce/api'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import DataCard from '@/components/layout/data-card'
import PillTabs from '@/components/layout/pill-tabs'
import { homeContent } from '@/data/home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { INTL_LOCALE, type Locale } from '@/lib/i18n'

type SalesOrdersChartProps = {
  data: DashboardChartsData
  loading: boolean
}

type Metric = 'sales' | 'orders'

const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }
const SHORT_DATE_OPTIONS = { day: 'numeric', month: 'short' } as const
const SHORT_DATE: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat(INTL_LOCALE.en, SHORT_DATE_OPTIONS),
  hi: new Intl.DateTimeFormat(INTL_LOCALE.hi, SHORT_DATE_OPTIONS),
}

function shortDay(iso: string, locale: Locale): string {
  return SHORT_DATE[locale].format(new Date(`${iso}T00:00:00+05:30`))
}

/** Total, and its percent change against the previous period; null when there is nothing to compare. */
function changeLine(
  totals: { current: number; previous: number | null },
  c: (typeof homeContent)['charts'],
): string | null {
  if (totals.previous === null) return c.salesNoPrevious
  if (totals.previous === 0) return null
  const pct = ((totals.current - totals.previous) / totals.previous) * 100
  if (Math.abs(pct) < 1) return c.salesFlat
  const formatted = `${Math.abs(pct).toFixed(0)}%`
  return c.salesLine(formatted, pct > 0)
}

/**
 * Sales (area, previous period dashed behind it) or orders (bars) for the picked range, with
 * a plain-language line under it. The range switch itself lives in the parent `ChartsPanel`.
 */
export default function SalesOrdersChart({ data, loading }: SalesOrdersChartProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const fmt = useFormat()
  const [metric, setMetric] = useState<Metric>('sales')

  // Render logic
  const c = copy.charts
  const points = data.days.map((day, i) => ({
    label: shortDay(day, fmt.locale),
    sales: data.salesPaise[i] ?? 0,
    previousSales: data.previousSalesPaise?.[i] ?? null,
    orders: data.orders[i] ?? 0,
  }))
  const totalSales = data.salesPaise.reduce((n, v) => n + v, 0)
  const previousTotalSales = data.previousSalesPaise
    ? data.previousSalesPaise.reduce((n, v) => n + v, 0)
    : null
  const line = changeLine({ current: totalSales, previous: previousTotalSales }, c)
  const config = {
    sales: { label: c.salesToggle, color: 'var(--chart-1)' },
    orders: { label: c.ordersToggle, color: 'var(--chart-2)' },
    previousSales: { label: c.previous, color: 'var(--chart-5)' },
  } satisfies ChartConfig
  const hasData = totalSales > 0 || data.orders.some((n) => n > 0)

  return (
    <DataCard
      title={c.salesTitle}
      action={
        <PillTabs
          variant="segmented"
          tabs={[
            { value: 'sales' as Metric, label: c.salesToggle },
            { value: 'orders' as Metric, label: c.ordersToggle },
          ]}
          value={metric}
          onChange={setMetric}
        />
      }
    >
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !hasData ? (
        <p className="text-body text-muted-foreground">{c.salesEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <ComposedChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="home-sales-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border-soft)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={AXIS_TICK}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={AXIS_TICK}
                tickFormatter={(v: number) =>
                  metric === 'sales' ? fmt.moneyCompact(v) : String(v)
                }
              />
              <ChartTooltip
                cursor={{ stroke: 'var(--chart-1)', strokeDasharray: '4 4' }}
                content={
                  <ChartTooltipContent
                    formatter={(v, name) => (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {name === 'previousSales'
                            ? c.previous
                            : name === 'orders'
                              ? c.ordersToggle
                              : c.salesToggle}
                        </span>
                        <span className="font-bold tabular-nums">
                          {name === 'orders' ? String(v) : fmt.money(Number(v))}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              {metric === 'sales' ? (
                <>
                  {data.previousSalesPaise ? (
                    <Line
                      dataKey="previousSales"
                      type="monotone"
                      stroke="var(--chart-5)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ) : null}
                  <Area
                    dataKey="sales"
                    type="monotone"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#home-sales-fill)"
                    isAnimationActive={false}
                    connectNulls
                  />
                </>
              ) : (
                <Bar
                  dataKey="orders"
                  fill="var(--chart-2)"
                  radius={4}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ChartContainer>
          {line ? <p className="text-caption text-muted-foreground">{line}</p> : null}
        </div>
      )}
    </DataCard>
  )
}

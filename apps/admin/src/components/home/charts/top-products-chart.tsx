'use client'

import type { DashboardChartsData } from '@commerce/api'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { formatPaise, formatPaiseCompact } from '@/lib/money'

type TopProductsChartProps = {
  data: DashboardChartsData
  loading: boolean
}

const LABEL_MAX = 16
const BAR_HEIGHT = 36

function shorten(text: string): string {
  return text.length > LABEL_MAX ? `${text.slice(0, LABEL_MAX - 1)}…` : text
}

const config = { revenuePaise: { label: 'Revenue', color: 'var(--chart-1)' } } satisfies ChartConfig

/** Top 5 products by revenue for the picked range, as a horizontal bar chart. */
export default function TopProductsChart({ data, loading }: TopProductsChartProps) {
  // Render logic
  const c = homeContent.charts
  const points = data.topProducts.map((p) => ({
    id: p.productId,
    label: shorten(p.title),
    fullTitle: p.title,
    revenuePaise: p.revenuePaise,
  }))

  return (
    <DataCard title={c.topProductsTitle}>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : points.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.topProductsEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart
              data={points}
              layout="vertical"
              margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
              barCategoryGap={10}
            >
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                tickFormatter={(v: number) => formatPaiseCompact(v)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={100}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(v, _name, item) => (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {(item.payload as { fullTitle: string }).fullTitle}
                        </span>
                        <span className="font-bold tabular-nums">{formatPaise(Number(v))}</span>
                      </span>
                    )}
                  />
                }
              />
              <Bar
                dataKey="revenuePaise"
                radius={4}
                maxBarSize={BAR_HEIGHT}
                isAnimationActive={false}
              >
                {points.map((p) => (
                  <Cell key={p.id} fill="var(--chart-1)" />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <p className="text-caption text-muted-foreground">
            {c.topProductsLine(points[0]?.fullTitle ?? '')}
          </p>
        </div>
      )}
    </DataCard>
  )
}

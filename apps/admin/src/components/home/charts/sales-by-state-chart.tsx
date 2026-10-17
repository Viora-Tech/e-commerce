'use client'

import type { DashboardSummary } from '@commerce/api'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { stateName } from '@/data/india'
import { useCopy, useFormat } from '@/hooks/use-copy'

type SalesByStateChartProps = {
  salesByState: DashboardSummary['salesByState']
}

const config = { revenuePaise: { label: 'Revenue', color: 'var(--chart-3)' } } satisfies ChartConfig

/** Top states by revenue over the last 30 days, reusing the same rows as the order map. */
export default function SalesByStateChart({ salesByState }: SalesByStateChartProps) {
  // Hooks
  const copy = useCopy(homeContent)
  const fmt = useFormat()

  // Render logic
  const c = copy.charts
  const points = salesByState.map((s) => ({
    code: s.stateCode,
    label: stateName(s.stateCode),
    revenuePaise: s.revenuePaise,
    share: s.share,
  }))
  const top = points[0]

  return (
    <DataCard title={c.stateTitle}>
      {points.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.stateEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ChartContainer config={config} className="aspect-auto h-48 w-full">
            <BarChart
              data={points}
              layout="vertical"
              margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
            >
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                tickFormatter={(v: number) => fmt.moneyCompact(v)}
              />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                width={90}
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              />
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(v) => (
                      <span className="font-bold tabular-nums">{fmt.money(Number(v))}</span>
                    )}
                  />
                }
              />
              <Bar dataKey="revenuePaise" radius={4} maxBarSize={22} isAnimationActive={false}>
                {points.map((p) => (
                  <Cell key={p.code} fill="var(--chart-3)" />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          {top ? (
            <p className="text-caption text-muted-foreground">
              {c.stateLine(top.label, `${Math.round(top.share * 100)}%`)}
            </p>
          ) : null}
        </div>
      )}
    </DataCard>
  )
}

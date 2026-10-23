'use client'

import type { MarketingKpi } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { Line, LineChart, XAxis } from 'recharts'
import DeltaChip from '@/components/layout/delta-chip'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatDay } from '@/lib/analytics-range'
import MetricLabel from '../metric-label'

type AttributedSalesCardProps = {
  attributed: MarketingKpi | undefined
  total: MarketingKpi | undefined
  days: string[]
}

/** "Sales attributed to marketing": the amount, of total store sales, its change and the line against the period before. */
export default function AttributedSalesCard({ attributed, total, days }: AttributedSalesCardProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.attributed)
  const fmt = useFormat()

  // Render logic
  const config = {
    value: { label: copy.current, color: 'var(--chart-1)' },
    before: { label: copy.previous, color: 'var(--muted-foreground)' },
  } satisfies ChartConfig
  const points = days.map((day, i) => ({
    label: formatDay(day),
    value: attributed?.series[i] ?? 0,
    before: attributed?.previousSeries?.[i] ?? 0,
  }))
  const hasData = points.some((p) => p.value > 0 || p.before > 0)
  const delta = attributed?.delta ?? null

  return (
    <Card inset={5} gap={3} className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <MetricLabel help={copy.help} className="text-body-strong text-foreground">
          {copy.label}
        </MetricLabel>
        <DeltaChip delta={delta === null ? null : delta * 100} size="kit" />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-stat tabular-nums text-foreground">
          {fmt.money(attributed?.value ?? 0)}
        </span>
        <span className="text-caption text-muted-foreground">
          {copy.ofTotal(fmt.money(total?.value ?? 0))}
        </span>
      </p>
      {hasData ? (
        <ChartContainer config={config} className="aspect-auto h-28 w-full">
          <LineChart data={points} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
            <XAxis dataKey="label" hide />
            <ChartTooltip
              cursor={{ stroke: 'var(--border)' }}
              content={
                <ChartTooltipContent
                  formatter={(v, name) => (
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {config[name as keyof typeof config]?.label}
                      </span>
                      <span className="font-semibold tabular-nums">{fmt.money(Number(v))}</span>
                    </span>
                  )}
                />
              }
            />
            <Line
              dataKey="before"
              type="monotone"
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
              strokeWidth={1.25}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--chart-1)"
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <p className="flex h-28 items-center text-caption text-muted-foreground">{copy.empty}</p>
      )}
    </Card>
  )
}

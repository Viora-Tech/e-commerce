'use client'

import type { ChannelRow, OverviewChannel } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@commerce/ui/shadcn/chart'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import PillTabs from '@/components/layout/pill-tabs'
import { CHANNEL_LABELS } from '@/data/growth'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import MetricLabel from '../metric-label'

type ChannelsChartCardProps = {
  channels: ChannelRow[]
  /** Attribution's taller card. */
  detailed?: boolean
}

type Metric = 'sales' | 'sessions'

const SHOWN = 6
/** Drawn at zero before any visit is tracked, so the chart keeps its shape. */
const PLACEHOLDER: OverviewChannel[] = [
  'direct',
  'organic_search',
  'social',
  'email',
  'whatsapp',
  'paid_social',
]
const AXIS_TICK = { fontSize: 12, fill: 'var(--muted-foreground)' }

function metricValue(row: ChannelRow, metric: Metric): number {
  return metric === 'sales' ? row.salesPaise : row.sessions
}

/**
 * Shopify's "Top channels": sales (or sessions) per channel as horizontal bars, the largest
 * first. With no activity yet the usual channels sit at zero under a muted note.
 */
export default function ChannelsChartCard({ channels, detailed = false }: ChannelsChartCardProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.channels)
  const fmt = useFormat()
  const [metric, setMetric] = useState<Metric>('sales')

  // Render logic
  const active = channels
    .filter((c) => metricValue(c, metric) > 0)
    .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
    .slice(0, SHOWN)
  const flat = active.length === 0
  const points = flat
    ? PLACEHOLDER.map((c) => ({ label: CHANNEL_LABELS[c], value: 0 }))
    : active.map((c) => ({ label: CHANNEL_LABELS[c.channel], value: metricValue(c, metric) }))
  const format = metric === 'sales' ? fmt.moneyCompact : fmt.compact
  const config = {
    value: { label: copy.metrics[metric], color: 'var(--chart-1)' },
  } satisfies ChartConfig

  return (
    <Card inset={5} gap={3} className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricLabel help={copy.help} className="text-body-strong text-foreground">
          {copy.label}
        </MetricLabel>
        <PillTabs
          variant="segmented"
          tabs={[
            { value: 'sales', label: copy.metrics.sales },
            { value: 'sessions', label: copy.metrics.sessions },
          ]}
          value={metric}
          onChange={setMetric}
        />
      </div>
      <div className={detailed ? 'relative h-72 w-full' : 'relative h-56 w-full'}>
        <ChartContainer config={config} className="aspect-auto size-full">
          <BarChart
            data={points}
            layout="vertical"
            margin={{ left: 0, right: 12, top: 4, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} stroke="var(--border-soft)" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              allowDecimals={false}
              tick={AXIS_TICK}
              domain={flat ? [0, 1] : [0, 'auto']}
              ticks={flat ? [0] : undefined}
              tickFormatter={(v: number) => format(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={104}
              tick={AXIS_TICK}
            />
            {flat ? null : (
              <ChartTooltip
                cursor={{ fill: 'var(--muted)' }}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    formatter={(v) => (
                      <span className="flex w-full items-center justify-between gap-3">
                        <span className="text-muted-foreground">{copy.metrics[metric]}</span>
                        <span className="font-semibold tabular-nums">{format(Number(v))}</span>
                      </span>
                    )}
                  />
                }
              />
            )}
            <Bar
              dataKey="value"
              fill="var(--chart-1)"
              radius={4}
              maxBarSize={22}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
        {flat ? (
          <p className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center px-4">
            <span className="rounded-md bg-card px-2 py-1 text-center text-caption text-muted-foreground">
              {copy.empty}
            </span>
          </p>
        ) : null}
      </div>
    </Card>
  )
}

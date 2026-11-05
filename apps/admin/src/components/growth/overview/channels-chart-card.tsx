'use client'

import type { ChannelRow, OverviewChannel } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import ChartLoading from '@/components/layout/chart-loading'
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

/* recharts is large: it loads only where a chart is drawn. */
const ChannelsChartPlot = dynamic(() => import('./channels-chart-plot'), {
  ssr: false,
  loading: () => <ChartLoading />,
})

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
        <ChannelsChartPlot
          points={points}
          flat={flat}
          label={copy.metrics[metric]}
          format={format}
        />
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

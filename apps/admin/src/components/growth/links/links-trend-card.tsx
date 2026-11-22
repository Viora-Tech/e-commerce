'use client'

import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PillTabs from '@/components/layout/pill-tabs'
import { growthLinksContent } from '@/data/growth'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { formatDay } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import GrowthTrendChart from '../growth-trend-chart'

type Trend = Awaited<ReturnType<typeof api.shortLinks.trend>>

type LinksTrendCardProps = {
  /** Bumped when a link is added or removed, to fetch the numbers again. */
  reloadKey: number
}

type Metric = 'clicks' | 'orders' | 'revenue'

const METRICS: Metric[] = ['clicks', 'orders', 'revenue']

function metricValue(day: Trend[number], metric: Metric): number {
  if (metric === 'revenue') return day.revenuePaise
  return metric === 'orders' ? day.orders : day.clicks
}

/** Growth → Links chart: clicks, orders or revenue across every link for each of the last 30 days. */
export default function LinksTrendCard({ reloadKey }: LinksTrendCardProps) {
  // Hooks
  const copy = useCopy(growthLinksContent.trend)
  const fmt = useFormat()
  // A failed read keeps the chart's zero line; the table below still loads.
  const { data } = useLoad(() => api.shortLinks.trend(), [reloadKey])
  const [metric, setMetric] = useState<Metric>('clicks')

  // Render logic
  const trend: Trend = data ?? []
  const points = trend.map((d) => ({ label: formatDay(d.day), value: metricValue(d, metric) }))
  const format = metric === 'revenue' ? fmt.moneyCompact : fmt.compact

  return (
    <DataCard
      title={copy.title}
      subtitle={copy.subtitle}
      action={
        <PillTabs
          variant="segmented"
          tabs={METRICS.map((m) => ({ value: m, label: copy.metrics[m] }))}
          value={metric}
          onChange={setMetric}
        />
      }
    >
      <GrowthTrendChart
        points={points}
        series={[{ key: 'value', label: copy.metrics[metric], color: 'var(--chart-1)' }]}
        formatValue={format}
        emptyNote={copy.empty}
        className="h-48"
      />
    </DataCard>
  )
}

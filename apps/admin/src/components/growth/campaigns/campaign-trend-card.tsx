'use client'

import type { CampaignDay } from '@commerce/api'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PillTabs from '@/components/layout/pill-tabs'
import { campaignPerformanceContent } from '@/data/growth-report'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatDay } from '@/lib/analytics-range'
import GrowthTrendChart from '../growth-trend-chart'

type CampaignTrendCardProps = { daily: CampaignDay[] }

type Metric = 'sessions' | 'orders' | 'sales'

const METRICS: Metric[] = ['sessions', 'orders', 'sales']

function metricValue(day: CampaignDay, metric: Metric): number {
  if (metric === 'sales') return day.salesPaise
  return metric === 'orders' ? day.orders : day.sessions
}

/** Shopify's campaign chart: sessions, orders or sales per day since the campaign began sending. */
export default function CampaignTrendCard({ daily }: CampaignTrendCardProps) {
  // Hooks
  const copy = useCopy(campaignPerformanceContent.trend)
  const fmt = useFormat()
  const [metric, setMetric] = useState<Metric>('sessions')

  // Render logic
  const points = daily.map((d) => ({ label: formatDay(d.day), value: metricValue(d, metric) }))
  const format = metric === 'sales' ? fmt.moneyCompact : fmt.compact

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
      />
    </DataCard>
  )
}

'use client'

import type { MarketingKpi } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import DeltaChip from '@/components/layout/delta-chip'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatDay } from '@/lib/analytics-range'
import GrowthTrendChart from '../growth-trend-chart'
import MetricLabel from '../metric-label'

type SessionsCardProps = {
  sessions: MarketingKpi | undefined
  days: string[]
  /** Attribution's taller chart. */
  detailed?: boolean
}

/** Shopify's "Sessions over time": the count, its change and the daily line against the period before. */
export default function SessionsCard({ sessions, days, detailed = false }: SessionsCardProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.sessions)
  const fmt = useFormat()

  // Render logic
  const points = days.map((day, i) => ({
    label: formatDay(day),
    value: sessions?.series[i] ?? 0,
    before: sessions?.previousSeries?.[i] ?? 0,
  }))
  const delta = sessions?.delta ?? null

  return (
    <Card inset={5} gap={3} className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <MetricLabel help={copy.help} className="text-body-strong text-foreground">
          {copy.label}
        </MetricLabel>
        <DeltaChip delta={delta === null ? null : delta * 100} size="kit" />
      </div>
      <p className="text-stat tabular-nums text-foreground">{fmt.number(sessions?.value ?? 0)}</p>
      <GrowthTrendChart
        points={points}
        series={[
          { key: 'before', label: copy.previous, color: 'var(--muted-foreground)', dashed: true },
          { key: 'value', label: copy.current, color: 'var(--chart-2)' },
        ]}
        formatValue={fmt.compact}
        emptyNote={copy.empty}
        className={detailed ? 'h-64' : 'h-44'}
      />
    </Card>
  )
}

'use client'

import type { AnalyticsKpi } from '@commerce/api'
import StatTile from '@/components/layout/stat-tile'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { formatCompact, formatPaiseCompact } from '@/lib/money'

type KpiTileProps = { kpi: AnalyticsKpi }

/** Money tiles read in rupees, rate tiles as percentages, the rest as plain counts. */
function formatValue(kpi: AnalyticsKpi): string {
  if (kpi.id === 'revenue' || kpi.id === 'aov') return formatPaiseCompact(kpi.value)
  if (kpi.id === 'conversion' || kpi.id === 'returning') return formatRate(kpi.value)
  return formatCompact(kpi.value)
}

/** One KPI as a stat tile: figure and change against the previous period. */
export default function KpiTile({ kpi }: KpiTileProps) {
  // Hooks
  const copy = useCopy(analyticsContent)

  // Render logic
  const trend = kpi.delta === null ? null : Math.round(kpi.delta * 1000) / 10

  return (
    <StatTile
      label={copy.kpis[kpi.id].label}
      value={formatValue(kpi)}
      trend={trend}
      trendNote={copy.compare}
    />
  )
}

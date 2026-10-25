'use client'

import type { AnalyticsKpi } from '@commerce/api'
import StatStrip from '@/components/layout/stat-strip'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { formatCompact, formatPaiseCompact } from '@/lib/money'

type KpiStripProps = { kpis: AnalyticsKpi[]; loading?: boolean }

/** Money tiles read in rupees, rate tiles as percentages, the rest as plain counts. */
function formatValue(kpi: AnalyticsKpi): string {
  if (kpi.id === 'revenue' || kpi.id === 'aov') return formatPaiseCompact(kpi.value)
  if (kpi.id === 'conversion' || kpi.id === 'returning') return formatRate(kpi.value)
  return formatCompact(kpi.value)
}

/** The KPIs as stat tiles: figure and change against the previous period. */
export default function KpiStrip({ kpis, loading }: KpiStripProps) {
  // Hooks
  const copy = useCopy(analyticsContent)

  // Render logic
  return (
    <StatStrip
      columns={3}
      loading={loading}
      tiles={kpis.map((kpi) => ({
        id: kpi.id,
        label: copy.kpis[kpi.id].label,
        value: formatValue(kpi),
        trend: kpi.delta === null ? null : Math.round(kpi.delta * 1000) / 10,
        trendNote: copy.compare,
        spark: kpi.series,
      }))}
    />
  )
}

'use client'

import type { MarketingKpi } from '@commerce/api'
import StatTile from '@/components/layout/stat-tile'
import { growthOverviewContent } from '@/data/growth'
import { useCopy } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { formatCompact, formatPaiseCompact } from '@/lib/money'

type GrowthKpiTileProps = { kpi: MarketingKpi }

function formatValue(kpi: MarketingKpi): string {
  if (kpi.id === 'attributed_sales') return formatPaiseCompact(kpi.value)
  if (kpi.id === 'conversion') return formatRate(kpi.value)
  return formatCompact(kpi.value)
}

/** One Growth KPI as a stat tile, the same as the Analytics ones so the two sections read alike. */
export default function GrowthKpiTile({ kpi }: GrowthKpiTileProps) {
  // Hooks
  const copy = useCopy(growthOverviewContent)

  // Render logic
  const trend = kpi.delta === null ? null : Math.round(kpi.delta * 1000) / 10

  return <StatTile label={copy.kpis[kpi.id].label} value={formatValue(kpi)} trend={trend} />
}

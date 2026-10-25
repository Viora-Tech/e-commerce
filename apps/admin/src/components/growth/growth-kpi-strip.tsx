'use client'

import type { MarketingKpi } from '@commerce/api'
import StatStrip from '@/components/layout/stat-strip'
import { growthOverviewContent } from '@/data/growth'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'

type GrowthKpiStripProps = { kpis: MarketingKpi[]; loading?: boolean }

/** Shopify's Marketing tiles, in its order. */
const TILES: MarketingKpi['id'][] = [
  'sessions',
  'conversion',
  'aov',
  'total_sales',
  'attributed_sales',
]

/**
 * The Growth overview's tiles: sessions, conversion, average order value, total sales and
 * sales from marketing, each against the previous period of the same length.
 */
export default function GrowthKpiStrip({ kpis, loading }: GrowthKpiStripProps) {
  // Hooks
  const copy = useCopy(growthOverviewContent)
  const fmt = useFormat()

  // Render logic
  const value = (kpi: MarketingKpi) => {
    if (kpi.id === 'conversion') return formatRate(kpi.value)
    if (kpi.id === 'sessions') return fmt.number(kpi.value)
    return fmt.money(kpi.value)
  }
  const tiles = TILES.flatMap((id) => {
    const kpi = kpis.find((k) => k.id === id)
    if (!kpi) return []
    return [
      {
        id,
        label: copy.kpis[id].label,
        value: value(kpi),
        trend: kpi.delta === null ? null : Math.round(kpi.delta * 1000) / 10,
        trendNote: copy.outcomes.vsPrevious,
        spark: kpi.series,
      },
    ]
  })

  return <StatStrip loading={loading} tiles={tiles} />
}
